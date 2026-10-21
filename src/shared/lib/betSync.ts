// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Traducción entre los boletos locales (AsyncStorage) y el backend Winzo.
// Sin dependencias de React Native para poder testearlo en Node.
import type { NewSlip, RemoteSlip } from '../types/remote';

type LocalEvent = Record<string, any>;
type LocalTicket = Record<string, any> & { events?: LocalEvent[] };

const text = (v: unknown) => typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : v == null ? '' : String(v);
const num = (v: unknown, max: number) => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) && n > 0 && n < max ? n : null;
};
const iso = (v: unknown) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

/** Texto de la selección tal como lo verá el backoffice; también sirve para casarla al volver. */
export function selectionText(e: LocalEvent): string {
  const home = text(e.homeTeam || e.home), away = text(e.awayTeam || e.away);
  const market = text(e.market || e.marketName), pick = text(e.selection || e.pick);
  const when = text(e.startTime || e.date || e.kickoff);
  return [`${home || '?'} - ${away || '?'}`, [market, pick].filter(Boolean).join(': '), when].filter(Boolean).join(' · ');
}

export const isSportsTicket = (t: LocalTicket) => !t.type || t.type === 'sports_bet';

export function toNewSlip(t: LocalTicket): NewSlip {
  const events = Array.isArray(t.events) ? t.events : [];
  const { _rawText, ...rest } = t;
  return {
    casa: text(t.operator ?? t.header?.operator) || undefined,
    importe: num(t.stake ?? t.stakeEUR, 1e8),
    cuota: num(t.finalOdds ?? t.header?.finalOdds, 1e7),
    // Fecha real del boleto; si no se pudo leer, la del escaneo.
    fecha: iso(t.issuedAt ?? t.header?.placedAtISO) ?? iso(t.scannedAt),
    entrada: t.entry === 'manual' ? 'manual' : 'scan',
    // Todo lo leído (premio potencial, id de la casa, equipos, horas…) para el backoffice.
    bruto: { app: 'bolettus', localId: t.id, ...rest, rawText: typeof _rawText === 'string' ? _rawText.slice(0, 10000) : undefined },
    // Elegida en la app con partido y mercado del backoffice: entra ya emparejada y se evalúa sola
    selecciones: events.map((e, index) => e.fixtureId && e.marketKey
      ? { rawText: selectionText(e), odds: num(e.odds, 1e7), fixtureId: e.fixtureId, market: e.marketKey, params: { ...(e.marketParams ?? {}), index } }
      : { rawText: selectionText(e), odds: num(e.odds, 1e7), params: { index } }),
  };
}

export type RemoteOutcome = {
  /** anulada = el servidor devolvió el importe (todas las selecciones nulas). */
  status: 'ganada' | 'perdida' | 'anulada' | null;
  legs: ('won' | 'lost' | 'void' | 'pending' | null)[];
  /** Lo que devuelve el boleto según el servidor (null = aún no se sabe). */
  payout: number | null;
};

/**
 * Selección del servidor que corresponde a cada selección local (mismo orden que `events`):
 * por su texto, si no por su posición al subirla y, en último caso, la siguiente libre.
 */
export function matchSelections(slip: RemoteSlip, events: LocalEvent[]): (RemoteSlip['selecciones'][number] | undefined)[] {
  const unused = [...slip.selecciones];
  return events.map((e, i) => {
    let at = unused.findIndex(s => s.raw_text === selectionText(e));
    if (at < 0) at = unused.findIndex(s => s.params?.index === i);
    if (at < 0 && unused.length) at = 0;
    return at < 0 ? undefined : unused.splice(at, 1)[0];
  });
}

/**
 * Estado del servidor para cada selección local. Una selección ya emparejada la decide el
 * servidor (también sus correcciones manuales: nula, revisión, reabierta → 'pending');
 * null = sin emparejar, la app sigue usando su propio cálculo.
 */
export function remoteOutcome(slip: RemoteSlip, events: LocalEvent[]): RemoteOutcome {
  const legs = matchSelections(slip, events).map(s => {
    if (!s || s.status === 'unmatched') return null;
    // Medio ganada cuenta como acertada y medio perdida como fallada (el dinero exacto va en payout)
    return s.status === 'won' || s.status === 'half_won' ? 'won' as const
      : s.status === 'lost' || s.status === 'half_lost' ? 'lost' as const
      : s.status === 'void' ? 'void' as const : 'pending' as const;
  });
  const status = slip.status === 'won' || slip.status === 'half_won' ? 'ganada'
    : slip.status === 'lost' || slip.status === 'half_lost' ? 'perdida'
    : slip.status === 'void' ? 'anulada' : null;
  return { status, legs, payout: status && slip.payout != null ? slip.payout : null };
}

/**
 * Cash out que hay que llevar al servidor: el del móvil manda. Solo boletos ya subidos y leídos
 * del servidor; si el servidor no tiene la migración 0010 (cashout_amount undefined) no se envía nada.
 */
export function cashoutPushes(bets: LocalTicket[], remote: Record<string, RemoteSlip>): { remoteId: string; amount: number | null }[] {
  return bets.flatMap(b => {
    const slip = b.remoteId ? remote[b.remoteId] : undefined;
    if (!slip || slip.cashout_amount === undefined) return [];
    const local = Number(b.cashout?.amount);
    const amount = Number.isFinite(local) && local > 0 ? Math.round(local * 100) / 100 : null;
    const server = slip.cashout_amount == null ? null : Math.round(Number(slip.cashout_amount) * 100) / 100;
    return amount === server ? [] : [{ remoteId: slip.id, amount }];
  });
}

export type ServerTicket = { id: string; raw: Record<string, any> | null; cashout_amount?: number | null };

/**
 * Al entrar en otra cuenta: qué boletos del servidor bajar al móvil y qué boletos del móvil
 * (subidos con la sesión anterior) hay que volver a subir a la cuenta nueva.
 */
export function planAccountSwitch(local: LocalTicket[], server: ServerTicket[]): { add: LocalTicket[]; reupload: string[] } {
  const serverIds = new Set(server.map(s => s.id));
  const localRemote = new Set(local.map(b => b.remoteId).filter(Boolean));
  const localIds = new Set(local.map(b => b.id).filter(Boolean));
  const reupload = local.filter(b => isSportsTicket(b) && b.remoteId && !serverIds.has(b.remoteId)).map(b => b.remoteId as string);
  const add = server
    .filter(s => !localRemote.has(s.id) && s.raw && Array.isArray(s.raw.events))
    .map(s => {
      const { app: _app, localId, rawText: _raw, ...ticket } = s.raw as Record<string, any>;
      const id = localId && !localIds.has(localId) ? localId : `srv-${s.id}`;
      const amount = Number(s.cashout_amount);
      return {
        ...ticket, type: ticket.type ?? 'sports_bet', id, remoteId: s.id,
        ...(amount > 0 ? { cashout: { amount, at: ticket.cashout?.at ?? '' } } : { cashout: undefined }),
      };
    });
  return { add, reupload };
}

/**
 * Boletos del servidor que no están en el móvil (creados en la web o en otro móvil con la misma cuenta).
 * No baja los que este móvil está subiendo (su localId ya existe aquí) ni los que tiene pendientes de borrar.
 */
export function planRemoteAdds(local: LocalTicket[], server: ServerTicket[], pendingDeletes: string[] = []): LocalTicket[] {
  const localRemote = new Set(local.map(b => b.remoteId).filter(Boolean));
  const localIds = new Set(local.map(b => b.id).filter(Boolean));
  const deleting = new Set(pendingDeletes);
  const fresh = server.filter(s => !localRemote.has(s.id) && !deleting.has(s.id)
    && !(s.raw?.localId && localIds.has(s.raw.localId)));
  return planAccountSwitch(local, fresh).add;
}
