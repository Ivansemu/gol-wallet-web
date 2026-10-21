// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Apuestas deportivas normalizadas + su estado (abierta/ganada/perdida/cobrada/anulada), sin React Native.
// El estado lo decide SIEMPRE el backend Winzo (worker + backoffice); la app no calcula resultados por su cuenta.
// Lo usan useSportsTickets (app) y la cartera de la web (gol-wallet-web), así las dos cuentan igual.
import type { RemoteSlip } from '../types/remote';
import { matchSelections, remoteOutcome } from './betSync';
import { cashoutOf, ticketReturn } from './cashout';
import { isSystemBet } from './systemBets';

/** 'cobrada' = cash out: la cerró el usuario en su casa; cuenta lo cobrado, no el resultado. */
/** 'anulada' = el servidor la liquidó como nula (todas las selecciones nulas): se devuelve el importe. */
export type BetStatus = 'abierta' | 'ganada' | 'perdida' | 'cobrada' | 'anulada';
export type FilterKey = 'todas' | BetStatus;

export type NormalizedEvent = {
  sport?: string;
  home?: string; away?: string; league?: string; competition?: string;
  market?: string; selection?: string; pick?: string; startTime?: string; odds?: number;
  /** Mismo número = mismo partido («Crear apuesta» con varias selecciones). */
  group?: number;
};

export type SportsTicket = {
  id: string; rawIdBase: string; operator: string;
  stake: number; maxWin: number; finalOdds: number; placedAt?: string;
  status: BetStatus;
  /** Importe cobrado con cash out (status 'cobrada'). */
  cashout?: number;
  /** Lo que devolvió el boleto según el servidor (nulas, medio ganada/perdida). null = no se sabe. */
  payout?: number | null;
  /** Lo que diría el resultado de las selecciones, aunque haya cash out. */
  outcome: Exclude<BetStatus, 'cobrada'>;
  /** Resultado de cada selección (para LegProgress). */
  /** void = selección nula: no cuenta ni como acertada ni como fallada. */
  legs: ('pending' | 'won' | 'lost' | 'void')[];
  events: NormalizedEvent[]; _raw: any;
};

export const isSportsBet = (b: any) => !b?.type || b.type === 'sports_bet';

/** Boletos guardados (formato de la app) → forma común, aún sin el estado del servidor. */
export function normalizeTickets(bets: any[]): SportsTicket[] {
  const sportsBets = (bets || []).filter(isSportsBet);
  const counts: Record<string, number> = {};
  for (const b of sportsBets) {
    const base = b.id?.toString() || b.betId?.toString() || 'bet';
    counts[base] = (counts[base] || 0) + 1;
  }
  return sportsBets.map((b: any, idx) => {
    const rawIdBase = b.id?.toString() || b.betId?.toString() || b.header?.betId?.toString() || 'bet';
    const id = counts[rawIdBase] > 1 ? `${rawIdBase}-${idx}` : rawIdBase;
    const events: NormalizedEvent[] = Array.isArray(b.events)
      ? b.events.map((e: any) => ({
          sport: e.sport || e.sportName || e.deporte || b.sport,
          home: e.homeTeam || e.home, away: e.awayTeam || e.away,
          league: e.league, competition: e.competition,
          market: e.market || e.marketName, selection: e.selection,
          pick: e.pick, startTime: e.startTime || e.date || e.kickoff || '',
          odds: e.odds != null ? Number(e.odds) : undefined,
          group: e.group != null ? Number(e.group) : undefined,
        }))
      : [];
    return {
      id, rawIdBase,
      operator: b.operator || b.header?.operator || 'Sin casa',
      stake:    Number(b.stake ?? b.stakeEUR ?? b.header?.stakeEUR ?? 0) || 0,
      maxWin:   Number(b.maxWin ?? b.potentialWinEUR ?? b.header?.potentialWinEUR ?? 0) || 0,
      finalOdds:Number(b.finalOdds ?? b.header?.finalOdds ?? 0) || 0,
      placedAt: b.issuedAt || b.header?.placedAtISO || b.scannedAt || undefined,
      status:   'abierta' as BetStatus,
      outcome:  'abierta' as const,
      legs:     events.map(() => 'pending' as const),
      events, _raw: b,
    };
  });
}

/** Aplica el estado del servidor. Selección sin resolver (sin emparejar, sin subir, en juego…) = pendiente. */
export function withServerState(normalized: SportsTicket[], remote: Record<string, RemoteSlip>): SportsTicket[] {
  return normalized.map(input => {
    let b = input;
    const slip = b._raw.remoteId ? remote[b._raw.remoteId] : undefined;
    const server = slip ? remoteOutcome(slip, b._raw.events ?? []) : null;
    // Equipo que no se leyó en el boleto («Real Betis - ?»): el del partido emparejado en el servidor
    if (slip && b.events.some(e => !e.home || !e.away)) {
      const sels = matchSelections(slip, b._raw.events ?? []);
      b = { ...b, events: b.events.map((e, i) => {
        const p = sels[i]?.partido;
        return (!e.home || !e.away) && p?.home?.name && p?.away?.name ? { ...e, home: p.home.name, away: p.away.name } : e;
      }) };
    }
    const legs = b.events.map((_, i) => {
      const o = server?.legs[i];
      return o === 'won' || o === 'lost' || o === 'void' ? o : 'pending' as const;
    });
    // Sistemas (trixie, yankee…): solo el estado del boleto que dé el servidor
    const system = isSystemBet(b._raw.betType);
    const fromLegs: BetStatus = system ? 'abierta'
      : legs.includes('lost') ? 'perdida' : legs.length && legs.every(l => l === 'won') ? 'ganada'
      : legs.length && legs.every(l => l === 'void') ? 'anulada' : 'abierta';
    const outcome = server?.status ?? fromLegs;
    // Cobro real del servidor: con nulas o mitades no es el premio máximo del boleto
    const payout = server?.payout ?? null;
    const settled = payout != null && outcome === 'ganada' ? { maxWin: payout } : {};
    // El cash out manda sobre el resultado (también si el servidor la resuelve después)
    const cashout = cashoutOf(b._raw);
    return cashout
      ? { ...b, legs, outcome, payout, status: 'cobrada' as const, cashout: cashout.amount }
      : { ...b, ...settled, legs, outcome, payout, status: outcome };
  });
}

export type TicketSummary = {
  count: number; stake: number; potential: number; balance: number | null; avgOdds: number | null;
  won: number; lost: number; open: number; cashedOut: number; voided: number;
};

export function summarizeTickets(tickets: SportsTicket[]): TicketSummary {
  const settled = tickets.filter(b => b.status !== 'abierta');
  const withOdds = tickets.filter(b => b.finalOdds > 0);
  return {
    count:     tickets.length,
    stake:     tickets.reduce((s, b) => s + b.stake, 0),
    // Premio aún posible: excluye las perdidas; las cobradas cuentan lo cobrado
    potential: tickets.reduce((s, b) => s + (b.status === 'perdida' ? 0 : b.status === 'cobrada' ? b.cashout ?? 0 : b.status === 'anulada' ? b.stake : b.maxWin), 0),
    balance:   settled.length
      ? settled.reduce((sum, b) => sum + ticketReturn(b) - b.stake, 0)
      : null,
    avgOdds:   withOdds.length ? withOdds.reduce((s, b) => s + b.finalOdds, 0) / withOdds.length : null,
    won:       tickets.filter(b => b.status === 'ganada').length,
    lost:      tickets.filter(b => b.status === 'perdida').length,
    open:      tickets.filter(b => b.status === 'abierta').length,
    cashedOut: tickets.filter(b => b.status === 'cobrada').length,
    voided:    tickets.filter(b => b.status === 'anulada').length,
  };
}

export function filterTickets(tickets: SportsTicket[], filter: FilterKey): SportsTicket[] {
  return filter === 'todas' ? tickets : tickets.filter(b => b.status === filter);
}
