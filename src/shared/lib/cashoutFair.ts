// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Cash out justo: cuánto vale ahora un boleto abierto y si la oferta de la casa es buena.
// Funciones puras (sin React Native) para poder testearlas. Es una ESTIMACIÓN, no una cuota real:
//
// · Antes del partido, cada selección vale la probabilidad que da su cuota sin el margen de la casa.
// · En juego, un modelo de goles de Poisson (el habitual en fútbol) se calibra con esa probabilidad
//   y se recalcula con el marcador y el minuto: lo que queda de partido decide.
// · Ganadas = 1, perdidas = 0, nulas = 1 (y su cuota deja de multiplicar).
// · Valor justo = premio que queda posible × probabilidad de que salga todo lo pendiente.

export const BOOKMAKER_MARGIN = 1.06;   // margen típico de una casa en España
const MAX_GOALS = 10;

export type LegState = {
  odds: number | null;
  /** won / lost / void / pending (incluye live_winning, live_losing) */
  status: string;
  market?: string | null;
  params?: Record<string, any> | null;
  /** Marcador y minuto si está en juego. */
  live?: { home: number; away: number; minute: number | null; halftime?: boolean;
    /** Minuto que dio el proveedor (el de `minute` puede ser estimado). */
    reportedMinute?: number | null;
    /** Cuándo se actualizó el marcador por última vez (ISO). */
    asOf?: string | null } | null;
};

export type LegValue = { p: number; how: 'won' | 'lost' | 'void' | 'pre' | 'model' | 'approx' };

/** Probabilidad «limpia» de una cuota: sin el margen de la casa. */
export function impliedProb(odds: number | null | undefined): number {
  if (!odds || odds <= 1) return 0.5;
  return Math.min(0.99, Math.max(0.01, 1 / odds / BOOKMAKER_MARGIN));
}

const pmfCache = new Map<string, number[]>();
function pmf(lambda: number): number[] {
  const key = lambda.toFixed(4);
  const hit = pmfCache.get(key);
  if (hit) return hit;
  const out: number[] = [];
  let p = Math.exp(-lambda);
  for (let k = 0; k <= MAX_GOALS; k++) { out.push(p); p = (p * lambda) / (k + 1); }
  if (pmfCache.size > 2000) pmfCache.clear();
  pmfCache.set(key, out);
  return out;
}

/** P(condición final) con el marcador actual (h, a) y los goles que quedan ~ Poisson(lh), Poisson(la). */
function probFinal(h: number, a: number, lh: number, la: number, ok: (fh: number, fa: number) => boolean): number {
  const ph = pmf(lh), pa = pmf(la);
  let total = 0, mass = 0;
  for (let i = 0; i <= MAX_GOALS; i++) for (let j = 0; j <= MAX_GOALS; j++) {
    const p = ph[i] * pa[j];
    mass += p;
    if (ok(h + i, a + j)) total += p;
  }
  // Normalizado: lo que queda por encima de 10 goles es despreciable y así lo ya cumplido vale 1
  return total / mass;
}

type Cond = (fh: number, fa: number) => boolean;

/** Condición de victoria de la selección (solo mercados que el modelo de goles entiende). */
export function legCondition(market?: string | null, params?: Record<string, any> | null): Cond | null {
  const p = params ?? {};
  if (market === 'match_result') {
    if (p.pick === 'home') return (h, a) => h > a;
    if (p.pick === 'away') return (h, a) => a > h;
    if (p.pick === 'draw') return (h, a) => h === a;
  }
  if (market === 'total_goals' && typeof p.line === 'number') {
    const goals: (h: number, a: number) => number = p.team === 'home' ? (h) => h : p.team === 'away' ? (_h, a) => a : (h, a) => h + a;
    return p.side === 'under' ? (h, a) => goals(h, a) < p.line : (h, a) => goals(h, a) > p.line;
  }
  if (market === 'btts') return p.pick === 'no' ? (h, a) => h === 0 || a === 0 : (h, a) => h > 0 && a > 0;
  return null;
}

/**
 * Fuerzas de los equipos (goles esperados en 90') que hacen que la selección tenga probabilidad p0 antes del partido.
 * Se ajusta la diferencia entre equipos (1X2) o el total de goles (más/menos, ambos marcan, empate).
 */
export function calibrate(cond: Cond, market: string | null | undefined, params: Record<string, any> | null | undefined, p0: number): { lh: number; la: number } {
  const pick = params?.pick;
  const bySkew = market === 'match_result' && (pick === 'home' || pick === 'away');
  const at = (x: number) => (bySkew ? { lh: 1.35 * Math.exp(x), la: 1.15 * Math.exp(-x) } : { lh: 1.45 * x, la: 1.15 * x });
  const prob = (x: number) => { const { lh, la } = at(x); return probFinal(0, 0, lh, la, cond); };
  let lo = bySkew ? -3 : 0.05, hi = bySkew ? 3 : 4;
  // ¿La probabilidad sube o baja al crecer x?
  const rising = prob(hi) > prob(lo);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if ((prob(mid) < p0) === rising) lo = mid; else hi = mid;
  }
  return at((lo + hi) / 2);
}

export function legValue(leg: LegState): LegValue {
  if (leg.status === 'won') return { p: 1, how: 'won' };
  if (leg.status === 'lost') return { p: 0, how: 'lost' };
  if (leg.status === 'void') return { p: 1, how: 'void' };
  const p0 = impliedProb(leg.odds);
  if (!leg.live) return { p: p0, how: 'pre' };
  const cond = legCondition(leg.market, leg.params);
  if (!cond) return { p: p0, how: 'approx' };
  const { lh, la } = calibrate(cond, leg.market, leg.params, p0);
  const minute = Math.min(95, Math.max(0, leg.live.halftime ? 45 : leg.live.minute ?? 0));
  const left = Math.max(0.02, (95 - minute) / 95);
  return { p: Math.min(1, Math.max(0, probFinal(leg.live.home, leg.live.away, lh * left, la * left, cond))), how: 'model' };
}

export type FairCashout = {
  /** Premio que aún se puede cobrar (sin las cuotas de las nulas). */
  payout: number;
  /** Probabilidad de que salga todo lo pendiente. */
  chance: number;
  /** Lo que vale el boleto ahora. */
  fair: number;
  legs: LegValue[];
  /** Hay selecciones en juego de un mercado que el modelo no entiende: valor más aproximado. */
  approximate: boolean;
  lost: boolean;
};

export function fairCashout(legs: LegState[], maxWin: number): FairCashout {
  const values = legs.map(legValue);
  const lost = values.some(v => v.how === 'lost');
  // Las nulas no multiplican: el premio baja en su cuota
  const voidOdds = legs.reduce((acc, l, i) => (values[i].how === 'void' && l.odds && l.odds > 1 ? acc * l.odds : acc), 1);
  const payout = lost ? 0 : maxWin / voidOdds;
  const chance = lost ? 0 : values.reduce((acc, v) => acc * v.p, 1);
  return { payout, chance, fair: Math.round(payout * chance * 100) / 100, legs: values, approximate: values.some(v => v.how === 'approx'), lost };
}

export type Verdict = { level: 'good' | 'fair' | 'low'; ratio: number; text: string };

/** Compara la oferta de la casa con el valor estimado. */
export function judgeOffer(offer: number, fair: number): Verdict | null {
  if (!(offer > 0) || !(fair > 0)) return null;
  const ratio = offer / fair;
  const pct = Math.round(Math.abs(1 - ratio) * 100);
  if (ratio >= 0.97) return { level: 'good', ratio, text: ratio >= 1.03 ? `Te ofrecen un ${pct} % más de lo que vale ahora: buena oferta.` : 'La oferta está en línea con lo que vale ahora: es justa.' };
  if (ratio >= 0.88) return { level: 'fair', ratio, text: `Te ofrecen un ${pct} % menos de lo que vale ahora: es lo habitual de las casas.` };
  return { level: 'low', ratio, text: `Te ofrecen un ${pct} % menos de lo que vale ahora: está por debajo de su valor.` };
}
