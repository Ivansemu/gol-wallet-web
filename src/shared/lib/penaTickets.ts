// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
import { lotteryResultOutcome } from './lotteryChecker';
import type { LotteryPrizeStatus } from '../types/tickets';
// Boletos de una peña: lo justo del boleto del móvil para que todos lo vean (snapshot) y el resultado que se
// propone al apuntarlo. Funciones puras (sin React Native) para poder testearlas.

type SportsLike = {
  stake: number; maxWin: number; finalOdds: number; operator: string; status: 'abierta' | 'ganada' | 'perdida' | 'cobrada' | 'anulada';
  cashout?: number; payout?: number | null; placedAt?: string;
  events: { home?: string; away?: string; market?: string; pick?: string; selection?: string; odds?: number; startTime?: string; sport?: string }[];
  _raw?: Record<string, any>;
};
type LotteryLike = {
  game: string; drawDate?: string; stake: number; lines?: { numbers: number[]; stars?: number[] }[];
  checkResult?: { totalPrize?: number; prizeStatus?: LotteryPrizeStatus } | null; collected?: { amount?: number } | null;
};

export type TicketSnapshot = {
  operator?: string; odds?: number; maxWin?: number; placedAt?: string;
  events?: { home: string; away: string; market: string; pick: string; odds?: number; startTime?: string }[];
  game?: string; drawDate?: string; lines?: { numbers: number[]; stars?: number[] }[];
};

export function sportsSnapshot(t: SportsLike): TicketSnapshot {
  return {
    operator: t.operator, odds: t.finalOdds, maxWin: t.maxWin, placedAt: t.placedAt,
    events: t.events.slice(0, 30).map(e => ({
      home: e.home ?? '', away: e.away ?? '', market: e.market ?? '', pick: e.pick ?? e.selection ?? '',
      ...(e.odds != null ? { odds: e.odds } : {}), ...(e.startTime ? { startTime: e.startTime } : {}),
    })),
  };
}

export function lotterySnapshot(t: LotteryLike): TicketSnapshot {
  return { game: t.game, drawDate: t.drawDate, lines: (t.lines ?? []).slice(0, 50).map(l => ({ numbers: l.numbers, ...(l.stars?.length ? { stars: l.stars } : {}) })) };
}

export type SuggestedResult = { status: 'won' | 'lost' | 'cashout'; prize: number } | null;

/** Resultado que se propone con lo que sabe el móvil (null = aún sin resolver). */
export function suggestSports(t: SportsLike): SuggestedResult {
  if (t.status === 'perdida') return { status: 'lost', prize: 0 };
  if (t.status === 'cobrada') return { status: 'cashout', prize: t.cashout ?? 0 };
  if (t.status === 'ganada') return { status: 'won', prize: t._raw?.collected?.amount ?? t.payout ?? t.maxWin };
  return null;
}
export function suggestLottery(t: LotteryLike): SuggestedResult {
  if (t.collected?.amount != null && t.collected.amount > 0) return { status: 'won', prize: t.collected.amount };
  const outcome = lotteryResultOutcome(t.checkResult);
  // Premio sin importe oficial o datos incompletos: no se sugiere nada (ni «perdido» ni un importe inventado)
  if (outcome === 'lost') return { status: 'lost', prize: 0 };
  const prize = Number(t.checkResult?.totalPrize ?? 0);
  return outcome === 'won' && prize > 0 && t.checkResult?.prizeStatus !== 'pending_amount' ? { status: 'won', prize } : null;
}

/** Partes iguales de un importe entre varios, al céntimo (la suma da exactamente el total). */
export function equalShares(total: number, n: number): number[] {
  if (n <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  return Array.from({ length: n }, (_, i) => (base + (i < cents - base * n ? 1 : 0)) / 100);
}
