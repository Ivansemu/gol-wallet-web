// Cartera de la web: los boletos viven en el servidor (bet_slips) y se leen con la MISMA lógica que la app
// (src/shared/lib/sportsTickets.ts). Lo que se crea aquí lleva el mismo formato que un boleto de la app, así
// la app lo baja tal cual (planRemoteAdds) y el backoffice lo ve igual.
import { planAccountSwitch, toNewSlip } from '../shared/lib/betSync';
import { normalizeTickets, withServerState, type SportsTicket } from '../shared/lib/sportsTickets';
import type { NewSlip, RemoteSlip } from '../shared/types/remote';

export type ServerSlipRow = RemoteSlip & {
  raw: Record<string, any> | null; bookmaker?: string | null; stake?: number | string | null; total_odds?: number | string | null;
  placed_at?: string | null; entry?: string | null; created_at?: string | null;
};

/** Boleto sin datos de la app (p. ej. creado a mano en el backoffice): se arma con las columnas. */
function fromColumns(row: ServerSlipRow): Record<string, any> {
  const stake = Number(row.stake ?? 0) || 0, odds = Number(row.total_odds ?? 0) || 0;
  return {
    id: `srv-${row.id}`, remoteId: row.id, type: 'sports_bet', operator: row.bookmaker ?? 'Sin casa',
    stake, finalOdds: odds, maxWin: Math.round(stake * odds * 100) / 100, issuedAt: row.placed_at ?? row.created_at ?? undefined,
    entry: row.entry ?? 'manual',
    events: row.selecciones.map(s => ({ home: s.raw_text ?? 'Selección', market: s.market_key ?? undefined })),
  };
}

/** Filas de bet_slips (con selecciones) → boletos con su estado, ordenados del más reciente al más antiguo. */
export function walletFromServer(rows: ServerSlipRow[]): { tickets: SportsTicket[]; remote: Record<string, RemoteSlip> } {
  const remote = Object.fromEntries(rows.map(r => [r.id, r]));
  const fromApp = planAccountSwitch([], rows.map(r => ({ id: r.id, raw: r.raw, cashout_amount: r.cashout_amount })));
  const covered = new Set(fromApp.add.map(t => t.remoteId));
  const locals = [...fromApp.add, ...rows.filter(r => !covered.has(r.id)).map(fromColumns)];
  const tickets = withServerState(normalizeTickets(locals), remote)
    .sort((a, b) => (Date.parse(b.placedAt ?? '') || 0) - (Date.parse(a.placedAt ?? '') || 0));
  return { tickets, remote };
}

export type ManualLeg = {
  home: string; away: string; market: string; pick: string; odds?: number | null; startTime?: string;
  /** Partido del backoffice y mercado evaluable: el servidor lo resuelve solo. */
  fixtureId?: string; marketKey?: string; marketParams?: Record<string, unknown>;
};

export type ManualInput = {
  operator: string; stake: number; odds?: number | null; placedAt?: string; legs: ManualLeg[]; id?: string;
  /** scan = leído de una foto y revisado por el usuario. */
  entry?: 'manual' | 'scan'; ticketId?: string; maxWin?: number | null;
};

/** Errores del formulario en español (vacío = se puede guardar). */
export function manualErrors(i: ManualInput): string[] {
  const e: string[] = [];
  if (!(i.stake > 0 && i.stake < 1e6)) e.push('Indica el importe apostado.');
  if (!i.legs.length) e.push('Añade al menos una selección.');
  i.legs.forEach((l, n) => {
    if (!l.home.trim() || !l.away.trim()) e.push(`Selección ${n + 1}: faltan los equipos.`);
    if (!l.pick.trim()) e.push(`Selección ${n + 1}: falta tu pronóstico.`);
    if (l.odds != null && !(l.odds > 1 && l.odds < 1e4)) e.push(`Selección ${n + 1}: la cuota debe ser mayor que 1.`);
  });
  return e;
}

/** Boleto en el formato de la app (mismo que guarda el móvil) a partir del formulario de la web. */
export function manualTicket(i: ManualInput, now = new Date()): Record<string, any> {
  const legOdds = i.legs.map(l => l.odds ?? null);
  const product = legOdds.every(o => o != null) ? legOdds.reduce((p, o) => p * (o as number), 1) : null;
  const finalOdds = i.odds ?? (product != null ? Math.round(product * 100) / 100 : 0);
  return {
    id: i.id ?? `web-${now.getTime().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    type: 'sports_bet', source: 'web', entry: i.entry ?? 'manual', ...(i.ticketId ? { ticketId: i.ticketId } : {}),
    operator: i.operator.trim() || 'Sin casa',
    stake: Math.round(i.stake * 100) / 100,
    finalOdds,
    maxWin: i.maxWin && i.maxWin > 0 ? i.maxWin : finalOdds ? Math.round(i.stake * finalOdds * 100) / 100 : 0,
    betType: i.legs.length > 1 ? 'combinada' : 'simple',
    issuedAt: i.placedAt ?? now.toISOString(),
    scannedAt: now.toISOString(),
    events: i.legs.map(l => ({
      homeTeam: l.home.trim(), awayTeam: l.away.trim(), market: l.market.trim(), selection: l.pick.trim(),
      odds: l.odds ?? undefined, startTime: l.startTime ?? '',
      ...(l.fixtureId && l.marketKey ? { fixtureId: l.fixtureId, marketKey: l.marketKey, marketParams: l.marketParams ?? {} } : {}),
    })),
  };
}

/** Lo que se inserta en el servidor: igual que la subida de la app, marcado como hecho en la web. */
export function slipForServer(ticket: Record<string, any>): NewSlip {
  const slip = toNewSlip(ticket);
  return { ...slip, bruto: { ...(slip.bruto as object), app: 'gol-wallet-web' } };
}

/** Boleto leído por el lector (parseOcrResponse) → formulario para revisarlo antes de guardar. */
export function reviewFromScan(t: Record<string, any>): ManualInput {
  return {
    operator: t.operator ?? '', stake: Number(t.stake) || 0, odds: Number(t.finalOdds) || null, maxWin: Number(t.maxWin) || null,
    placedAt: t.issuedAt || undefined, entry: 'scan', ticketId: t.ticketId,
    legs: (t.events ?? []).map((e: any) => ({
      home: e.home ?? e.homeTeam ?? '', away: e.away ?? e.awayTeam ?? '', market: e.market ?? '', pick: e.pick ?? e.selection ?? '',
      odds: e.odds != null && Number(e.odds) > 1 ? Number(e.odds) : null, startTime: e.startTime ?? '',
    })),
  };
}
