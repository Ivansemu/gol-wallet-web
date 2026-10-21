// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Herramientas: calculadoras, patrones de juego, rachas, banca y simulador de boletos.
// Funciones puras (sin React Native) para poder testearlas.
import { calculateSystemBet, type SystemBetType } from './systemBets';
import { lotteryResultOutcome } from './lotteryChecker';
import type { LotteryPrizeStatus } from '../types/tickets';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Calculadoras ───────────────────────────────────────────────────────────

/** Margen de la casa en un mercado (1-X-2 o dos opciones) y probabilidades/cuotas justas. */
export function bookMargin(odds: number[]): { margin: number; probs: number[]; fairOdds: number[] } | null {
  if (odds.length < 2 || odds.some(o => !(o > 1))) return null;
  const inv = odds.map(o => 1 / o);
  const sum = inv.reduce((a, b) => a + b, 0);
  const probs = inv.map(p => p / sum);
  return { margin: (sum - 1) * 100, probs, fairOdds: probs.map(p => 1 / p) };
}

/** ¿Tiene valor? Con tu probabilidad estimada (0-1) y la cuota: lo que ganas o pierdes de media por cada 10 €. */
export function valueCheck(odds: number, myProb: number) {
  if (!(odds > 1) || !(myProb > 0 && myProb < 1)) return null;
  const breakEven = 1 / odds;
  const evPer10 = round2(10 * (myProb * odds - 1));
  return { breakEven, evPer10, hasValue: myProb > breakEven };
}

/** Cuota decimal → fraccional, americana y probabilidad implícita. */
export function convertOdds(decimal: number) {
  if (!(decimal > 1)) return null;
  const profit = decimal - 1;
  // Fracción aproximada con denominador hasta 20
  let best = { n: Math.round(profit), d: 1, err: Infinity };
  for (let d = 1; d <= 20; d++) {
    const n = Math.round(profit * d);
    const err = Math.abs(n / d - profit);
    if (n > 0 && err < best.err - 1e-9) best = { n, d, err };
  }
  const american = decimal >= 2 ? `+${Math.round(profit * 100)}` : `${Math.round(-100 / profit)}`;
  return { fractional: `${best.n}/${best.d}`, american, prob: 1 / decimal };
}

/** Fraccional («5/2») o americana («+150», «-200») → decimal. */
export function toDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.');
  const frac = s.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (frac) return Number(frac[2]) > 0 ? 1 + Number(frac[1]) / Number(frac[2]) : null;
  const us = s.match(/^([+-])(\d+(?:\.\d+)?)$/);
  if (us) { const v = Number(us[2]); return v > 0 ? (us[1] === '+' ? 1 + v / 100 : 1 + 100 / v) : null; }
  const dec = Number(s);
  return dec > 1 ? dec : null;
}

export const QUINIELA_BET_PRICE = 0.75;
/** Quiniela múltiple: dobles y triples → apuestas y coste. */
export function quinielaMultiple(doubles: number, triples: number) {
  const bets = 2 ** doubles * 3 ** triples;
  return { bets, cost: round2(bets * QUINIELA_BET_PRICE) };
}

/** Probabilidad de acertar el premio mayor (1 entre N). */
export const JACKPOT_ODDS: Record<string, { name: string; oneIn: number; note: string }> = {
  euromillones: { name: 'Euromillones', oneIn: 139_838_160, note: '5 números + 2 estrellas' },
  primitiva: { name: 'La Primitiva', oneIn: 13_983_816, note: '6 aciertos (con reintegro, 1 entre 139.838.160)' },
  bonoloto: { name: 'Bonoloto', oneIn: 13_983_816, note: '6 aciertos' },
  gordo: { name: 'El Gordo de la Primitiva', oneIn: 31_625_100, note: '5 números + número clave' },
  eurodreams: { name: 'EuroDreams', oneIn: 19_191_900, note: '6 números + sueño' },
  quiniela: { name: 'La Quiniela', oneIn: 4_782_969, note: '14 aciertos con apuesta sencilla' },
};

// ─── Tus patrones ───────────────────────────────────────────────────────────

type TicketLike = {
  stake: number; status: string; maxWin: number; cashout?: number; finalOdds: number; operator: string;
  placedAt?: string; events: unknown[]; _raw: Record<string, any>;
};
const returned = (t: TicketLike) => (t.status === 'cobrada' ? t.cashout ?? 0 : t.status === 'anulada' ? t.stake : t.status === 'ganada' ? (t._raw?.collected?.amount ?? t.maxWin) : 0);
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export type PatternRow = { label: string; tickets: number; staked: number; result: number; roi: number };
export type PatternDim = 'casa' | 'selecciones' | 'dia' | 'hora' | 'cuota';

function keyOf(t: TicketLike, dim: PatternDim, casaName: (id?: string) => string | null): string | null {
  const d = t.placedAt ? new Date(t.placedAt.replace(' ', 'T')) : null;
  switch (dim) {
    case 'casa': return casaName(t._raw?.casaId) ?? t.operator ?? 'Sin casa';
    case 'selecciones': { const n = t.events.length; return n <= 1 ? 'Sencillas' : n <= 3 ? '2-3 selecciones' : n <= 5 ? '4-5 selecciones' : '6 o más'; }
    case 'dia': return d && !Number.isNaN(d.getTime()) ? WEEKDAYS[d.getDay()] : null;
    case 'hora': {
      if (!d || Number.isNaN(d.getTime())) return null;
      const h = d.getHours();
      return h < 12 ? 'Mañana (hasta 12:00)' : h < 17 ? 'Tarde (12-17)' : h < 21 ? 'Tarde-noche (17-21)' : 'Noche (desde 21:00)';
    }
    case 'cuota': { const o = t.finalOdds; return !o ? null : o < 1.5 ? 'Cuota < 1,50' : o < 2.5 ? '1,50 - 2,50' : o < 5 ? '2,50 - 5' : o < 15 ? '5 - 15' : 'Más de 15'; }
  }
}

/** Rentabilidad por grupo con los boletos ya decididos (las abiertas no cuentan). Ordenado de peor a mejor. */
export function patterns(tickets: TicketLike[], dim: PatternDim, casaName: (id?: string) => string | null = () => null): PatternRow[] {
  const by = new Map<string, { tickets: number; staked: number; ret: number }>();
  for (const t of tickets) {
    if (t.status === 'abierta' || !(t.stake > 0)) continue;
    const k = keyOf(t, dim, casaName);
    if (!k) continue;
    const g = by.get(k) ?? { tickets: 0, staked: 0, ret: 0 };
    g.tickets++; g.staked += t.stake; g.ret += returned(t);
    by.set(k, g);
  }
  return [...by.entries()].map(([label, g]) => ({
    label, tickets: g.tickets, staked: round2(g.staked), result: round2(g.ret - g.staked), roi: g.staked ? ((g.ret - g.staked) / g.staked) * 100 : 0,
  })).sort((a, b) => a.result - b.result);
}

/** Cuota media frente a acierto: qué porcentaje necesitarías para no perder. */
export function oddsVsHits(tickets: TicketLike[]) {
  const settled = tickets.filter(t => (t.status === 'ganada' || t.status === 'perdida') && t.finalOdds > 1);
  if (settled.length < 3) return null;
  const avgOdds = settled.reduce((s, t) => s + t.finalOdds, 0) / settled.length;
  const hitRate = settled.filter(t => t.status === 'ganada').length / settled.length;
  return { count: settled.length, avgOdds, hitRate, needed: 1 / avgOdds };
}

// ─── Rachas (perseguir pérdidas) ────────────────────────────────────────────

/** Aviso si en las últimas 3 h has hecho 3 o más apuestas, o tus 3 últimas apuestas doblan tu importe habitual. */
export function chasingAlert(tickets: TicketLike[], now = new Date()): string | null {
  const dated = tickets
    .map(t => ({ t, d: t.placedAt ? new Date(t.placedAt.replace(' ', 'T')) : null }))
    .filter((x): x is { t: TicketLike; d: Date } => !!x.d && !Number.isNaN(x.d.getTime()))
    .sort((a, b) => a.d.getTime() - b.d.getTime());
  if (dated.length < 4) return null;
  const recent = dated.filter(x => now.getTime() - x.d.getTime() < 3 * 3_600_000 && x.d.getTime() <= now.getTime());
  const lossesBefore = dated.filter(x => x.t.status === 'perdida' && now.getTime() - x.d.getTime() < 24 * 3_600_000).length;
  if (recent.length >= 3 && lossesBefore >= 1) return `Has registrado ${recent.length} apuestas en las últimas 3 horas después de perder. Párate un momento antes de la siguiente.`;
  const stakes = dated.slice(0, -3).map(x => x.t.stake).filter(s => s > 0).sort((a, b) => a - b);
  if (stakes.length >= 5) {
    const median = stakes[Math.floor(stakes.length / 2)];
    const last3 = dated.slice(-3).map(x => x.t.stake);
    const avg = last3.reduce((a, b) => a + b, 0) / 3;
    const recentWeek = dated.slice(-3).every(x => now.getTime() - x.d.getTime() < 7 * 86_400_000);
    if (recentWeek && median > 0 && avg >= median * 2) return `Tus últimas apuestas son de ${round2(avg).toFixed(2).replace('.', ',')} € de media, más del doble de lo habitual (${median.toFixed(2).replace('.', ',')} €).`;
  }
  return null;
}

// ─── Banca ──────────────────────────────────────────────────────────────────

/** Importe máximo sugerido por apuesta: un porcentaje de tu saldo total. */
export const suggestedStake = (balance: number, pct: number) => round2(Math.max(0, balance) * pct / 100);

/** A este ritmo: lo jugado a fin de mes. */
export function monthProjection(spent: number, now = new Date()) {
  const day = now.getDate();
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { day, days, projected: round2((spent / Math.max(1, day)) * days) };
}

// ─── Simulador «¿y si…?» ────────────────────────────────────────────────────

export type SimLeg = { odds: number | null; outcome: 'won' | 'lost' | 'void' | 'pending' };

/**
 * Cobro con un resultado supuesto de cada selección (las pendientes se suponen acertadas).
 * Combinadas: todo acertado → importe × cuotas (las nulas cuentan 1). Sistemas: líneas acertadas.
 */
export function simulate(legs: SimLeg[], stake: number, maxWin: number, system?: { type: SystemBetType; stakePerLine: number } | null): number {
  if (system) {
    const sels = legs.map(l => ({ odds: l.outcome === 'void' ? 1 : l.odds ?? 1, won: l.outcome !== 'lost' }));
    return round2(calculateSystemBet(sels, system.type, system.stakePerLine).currentReturn);
  }
  if (legs.some(l => l.outcome === 'lost')) return 0;
  const allOdds = legs.every(l => l.odds && l.odds > 1);
  if (!allOdds) {
    const voidOdds = legs.reduce((acc, l) => (l.outcome === 'void' && l.odds ? acc * l.odds : acc), 1);
    return round2(maxWin / voidOdds);
  }
  return round2(stake * legs.reduce((acc, l) => acc * (l.outcome === 'void' ? 1 : l.odds!), 1));
}

// ─── Lotería ────────────────────────────────────────────────────────────────

type LotteryLike = { game?: string; stake?: number; drawDate?: string; scannedAt?: string; checkResult?: { totalPrize?: number; prizeStatus?: LotteryPrizeStatus } | null };
export type LotteryGameStat = { game: string; count: number; spent: number; prizes: number; net: number; best: number };

/** Lo jugado y lo ganado en lotería, por juego (de mayor a menor gasto). */
export function lotteryStats(tickets: LotteryLike[]) {
  const by = new Map<string, LotteryGameStat>();
  let pending = 0;
  let best: { game: string; amount: number; date: string } | null = null;
  for (const t of tickets) {
    const game = t.game ?? 'unknown_lottery';
    const g = by.get(game) ?? { game, count: 0, spent: 0, prizes: 0, net: 0, best: 0 };
    const prize = Number(t.checkResult?.totalPrize ?? 0) || 0;
    g.count++; g.spent += Number(t.stake ?? 0) || 0; g.prizes += prize; g.best = Math.max(g.best, prize);
    if (lotteryResultOutcome(t.checkResult) === 'pending') pending++;
    if (prize > 0 && (!best || prize > best.amount)) best = { game, amount: prize, date: String(t.drawDate ?? t.scannedAt ?? '').slice(0, 10) };
    by.set(game, g);
  }
  const games = [...by.values()].map(g => ({ ...g, spent: round2(g.spent), prizes: round2(g.prizes), net: round2(g.prizes - g.spent) })).sort((a, b) => b.spent - a.spent);
  const spent = round2(games.reduce((s, g) => s + g.spent, 0));
  const prizes = round2(games.reduce((s, g) => s + g.prizes, 0));
  return { games, spent, prizes, net: round2(prizes - spent), returnRate: spent > 0 ? prizes / spent : 0, pending, best, count: tickets.length };
}

/** Premio de SELAE tras la retención: 20 % de lo que pase de 40.000 € por décimo o apuesta. */
export function lotteryNet(prize: number) {
  const taxable = Math.max(0, prize - 40_000);
  const withholding = round2(taxable * 0.2);
  return { withholding, net: round2(prize - withholding) };
}

// ─── Rachas ─────────────────────────────────────────────────────────────────

type StreakLike = { status: string; stake: number; cashout?: number; placedAt?: string };
export type Streaks = { current: { kind: 'won' | 'lost'; length: number } | null; bestWon: number; worstLost: number; decided: number };

/**
 * Rachas con los boletos decididos, por fecha: la actual, la mejor ganadora y la peor perdedora.
 * Un cash out cuenta como ganado si recupera al menos lo apostado.
 */
export function streaks(tickets: StreakLike[]): Streaks {
  const results = tickets
    .filter(t => t.status !== 'abierta' && t.placedAt)
    .map(t => ({ d: new Date(t.placedAt!.replace(' ', 'T')).getTime(), won: t.status === 'ganada' || (t.status === 'cobrada' && (t.cashout ?? 0) >= t.stake) }))
    .filter(x => !Number.isNaN(x.d))
    .sort((a, b) => a.d - b.d);
  let bestWon = 0, worstLost = 0, run = 0, prev: boolean | null = null;
  for (const r of results) {
    run = r.won === prev ? run + 1 : 1;
    prev = r.won;
    if (r.won) bestWon = Math.max(bestWon, run); else worstLost = Math.max(worstLost, run);
  }
  return { current: prev == null ? null : { kind: prev ? 'won' : 'lost', length: run }, bestWon, worstLost, decided: results.length };
}

// ─── Calculadora de combinadas y sistemas ───────────────────────────────────

/** Selecciones que necesita cada tipo de apuesta (null: cualquier número; mínimo en `min`). */
export const BET_CALC_SIZES: Record<SystemBetType, { sels: number | null; min: number }> = {
  single: { sels: null, min: 1 }, combo: { sels: null, min: 2 }, trixie: { sels: 3, min: 3 }, patent: { sels: 3, min: 3 },
  yankee: { sels: 4, min: 4 }, lucky15: { sels: 4, min: 4 }, canadian: { sels: 5, min: 5 }, heinz: { sels: 6, min: 6 },
  superheinz: { sels: 7, min: 7 }, goliath: { sels: 8, min: 8 },
};

/**
 * Lo que cuesta y lo que paga una apuesta antes de hacerla: sencillas (una por selección), combinada o sistema.
 * `stakePerLine` es el importe de cada apuesta. `oneFails`: lo que cobras si falla la selección de cuota más alta.
 */
export function betCalc(odds: number[], type: SystemBetType, stakePerLine: number) {
  const size = BET_CALC_SIZES[type];
  if (!(stakePerLine > 0) || odds.some(o => !(o > 1))) return null;
  if (size.sels != null ? odds.length !== size.sels : odds.length < size.min) return null;
  const sels = odds.map(o => ({ odds: o, won: true }));
  const all = calculateSystemBet(sels, type, stakePerLine);
  const worst = odds.indexOf(Math.max(...odds));
  const oneFails = calculateSystemBet(sels.map((s, i) => (i === worst ? { ...s, won: false } : s)), type, stakePerLine).currentReturn;
  return {
    lines: all.linesTotal,
    totalStake: round2(all.totalStake),
    maxReturn: round2(all.maxWin),
    profit: round2(all.maxWin - all.totalStake),
    combinedOdds: odds.reduce((a, o) => a * o, 1),
    oneFails: round2(oneFails),
  };
}

// ─── Tus números de lotería ─────────────────────────────────────────────────

type NumbersLike = { game?: string; lines?: { numbers?: number[]; stars?: number[] }[]; checkResult?: { winningNumbers?: number[]; winningStars?: number[] } | null };
export type NumberCount = { n: number; played: number; hits: number };

/** Juegos de bolas donde tiene sentido contar los números que juegas. */
export const NUMBER_GAMES = ['euromillones', 'primitiva', 'bonoloto', 'gordo', 'eurodreams'] as const;

/**
 * Los números (y estrellas) que más juegas en un juego y cuántas veces han salido en tus sorteos ya comprobados.
 * Ordenado de más a menos jugado; a igualdad, por número.
 */
export function playedNumbers(tickets: NumbersLike[], game: string) {
  const nums = new Map<number, NumberCount>();
  const stars = new Map<number, NumberCount>();
  let lines = 0, count = 0;
  const add = (map: Map<number, NumberCount>, n: number, hit: boolean) => {
    const c = map.get(n) ?? { n, played: 0, hits: 0 };
    c.played++; if (hit) c.hits++;
    map.set(n, c);
  };
  for (const t of tickets) {
    if (t.game !== game || !t.lines?.length) continue;
    count++;
    const wn = new Set(t.checkResult?.winningNumbers ?? []);
    const ws = new Set(t.checkResult?.winningStars ?? []);
    for (const l of t.lines) {
      if (!l.numbers?.length) continue;
      lines++;
      for (const n of new Set(l.numbers)) add(nums, n, wn.has(n));
      for (const n of new Set(l.stars ?? [])) add(stars, n, ws.has(n));
    }
  }
  const sort = (m: Map<number, NumberCount>) => [...m.values()].sort((a, b) => b.played - a.played || a.n - b.n);
  return { numbers: sort(nums), stars: sort(stars), lines, tickets: count };
}
