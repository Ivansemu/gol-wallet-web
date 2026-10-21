// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Selecciones de un boleto con su estado en el servidor, listas para el cash out justo y el simulador.
// Función pura (sin React Native) para poder testearla.
import type { RemoteSlip } from '../types/remote';
import { matchSelections } from './betSync';
import { hasMatchClock } from './selectionInsight';
import type { LegState } from './cashoutFair';
import type { SystemBetType } from './systemBets';

type TicketLike = { events: { odds?: number }[]; _raw: Record<string, any> };

/**
 * Minuto estimado ahora: el último que dio el proveedor más el tiempo pasado desde esa actualización.
 * El marcador llega cada pocos minutos; sin esto el modelo calcularía con un minuto atrasado.
 * Primera parte: hasta el 47' (después no sabemos si ya es el descanso). Segunda: hasta el 95'.
 */
export function liveMinute(minute: number | null, updatedAt: string | null | undefined, now: number, halftime = false): number | null {
  if (halftime) return 45;
  if (minute == null) return null;
  const t = updatedAt ? new Date(updatedAt).getTime() : NaN;
  const elapsed = Number.isFinite(t) && now > t ? Math.min(30, Math.floor((now - t) / 60_000)) : 0;
  return Math.min(minute <= 45 ? 47 : 95, minute + elapsed);
}

export function ticketLegs(ticket: TicketLike, remote: Record<string, RemoteSlip>, now = Date.now()): LegState[] {
  const slip = ticket._raw?.remoteId ? remote[ticket._raw.remoteId] : undefined;
  const sels = slip ? matchSelections(slip, ticket._raw.events ?? []) : [];
  return ticket.events.map((ev, i) => {
    const s = sels[i];
    const p = s?.partido;
    const playing = !!p && (p.status === 'live' || p.status === 'halftime');
    const status = !s ? 'pending'
      : s.status === 'won' || s.status === 'half_won' ? 'won'
      : s.status === 'lost' || s.status === 'half_lost' ? 'lost'
      : s.status === 'void' ? 'void' : 'pending';
    return {
      odds: ev.odds ?? null, status, market: s?.market_key ?? null, params: s?.params ?? null,
      live: playing ? {
        home: p!.home_score ?? 0, away: p!.away_score ?? 0, halftime: p!.status === 'halftime',
        // Fuera del fútbol no hay reloj de 90': sin minuto (ni estimado)
        minute: hasMatchClock(p!.sport) ? liveMinute(p!.minute, p!.updated_at, now, p!.status === 'halftime') : null,
        reportedMinute: hasMatchClock(p!.sport) ? p!.minute : null, asOf: p!.updated_at ?? null,
      } : null,
    };
  });
}

const SYSTEMS: [RegExp, SystemBetType][] = [
  [/trixie/i, 'trixie'], [/patent/i, 'patent'], [/yankee/i, 'yankee'], [/lucky\s*15/i, 'lucky15'],
  [/canadian|super\s*yankee/i, 'canadian'], [/super\s*heinz/i, 'superheinz'], [/heinz/i, 'heinz'], [/goliath/i, 'goliath'],
];

/** Tipo de sistema del boleto (trixie, yankee…) si lo es; null para sencillas y combinadas. */
export function systemOf(raw: Record<string, any>, stake: number): { type: SystemBetType; stakePerLine: number } | null {
  const name = String(raw?.betType ?? '');
  const hit = SYSTEMS.find(([re]) => re.test(name));
  if (!hit) return null;
  const lines: Record<SystemBetType, number> = { single: 1, combo: 1, trixie: 4, patent: 7, yankee: 11, lucky15: 15, canadian: 26, heinz: 57, superheinz: 120, goliath: 247 };
  const perLine = Number(raw?.stakePerLine) || stake / lines[hit[1]];
  return { type: hit[1], stakePerLine: perLine };
}
