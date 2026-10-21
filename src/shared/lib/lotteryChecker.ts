// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// src/lib/lotteryChecker.ts
// Verificación de resultados de lotería.
// Patrón adaptador: MockLotteryAdapter activo hasta integrar la API real.
// Para añadir la API real: implementar LotteryApiAdapter y sustituir la instancia.

import type {
  LotteryTicket,
  LotteryGame,
  LotteryLine,
  LotteryCheckResult,
  LotteryLineResult,
  SelectionResult,
  LotteryPrizeStatus,
} from '../types/tickets';

// ─── INTERFAZ ADAPTADORA ──────────────────────────────────────────

export type DrawResult = {
  game:             LotteryGame;
  drawDate:         string;
  winningNumbers:   number[];
  winningStars?:    number[];
  complementario?:  number;
  reintegro?:       number;
  elKey?:           number;
  jackpot?:         number;
  /** Importe oficial por categoría (clave = la de evaluateLine: '5+2', '5+C', 'R', '14'…). Sin él no hay importe. */
  prizes?:          Record<string, number>;
  /** De dónde salen los importes (p. ej. «SELAE, acta del 20/10/2026»). */
  prizesSource?:    string;
  // Quiniela
  results?:         string[];   // ['1', 'X', '2', ...]
};

export interface LotteryApiAdapter {
  getLastDraw(game: LotteryGame): Promise<DrawResult | null>;
  getDrawByDate(game: LotteryGame, date: string): Promise<DrawResult | null>;
  isAvailable(): boolean;
}

// ─── ADAPTADOR MOCK ───────────────────────────────────────────────

export class MockLotteryAdapter implements LotteryApiAdapter {
  isAvailable() { return true; }

  async getLastDraw(game: LotteryGame): Promise<DrawResult | null> {
    const today = new Date().toISOString().split('T')[0];
    const mocks: Partial<Record<LotteryGame, DrawResult>> = {
      euromillones: {
        game, drawDate: today,
        winningNumbers: [3, 12, 23, 34, 45],
        winningStars:   [2, 9],
        jackpot: 45_000_000,
      },
      bonoloto: {
        game, drawDate: today,
        winningNumbers: [5, 11, 22, 33, 44, 48],
        complementario: 7, reintegro: 3,
        jackpot: 800_000,
      },
      primitiva: {
        game, drawDate: today,
        winningNumbers: [2, 10, 21, 32, 43, 49],
        complementario: 14, reintegro: 5,
        jackpot: 3_200_000,
      },
      gordo: {
        game, drawDate: today,
        winningNumbers: [4, 13, 24, 35, 54],
        elKey: 8,
        jackpot: 5_000_000,
      },
      once: {
        game, drawDate: today,
        winningNumbers: [12345],
        jackpot: 35_000,
      },
      eurodreams: {
        game, drawDate: today,
        winningNumbers: [5, 14, 23, 32, 41, 50],
        winningStars: [2],
        jackpot: 20_000,  // renta mensual × 240 meses
      },
      loteria_nacional: {
        game, drawDate: today,
        winningNumbers: [34567],
        jackpot: 300_000,
      },
      quiniela: {
        game, drawDate: today,
        winningNumbers: [],
        results: ['1','X','1','2','1','X','2','1','X','1','2','X','1','1'],
      },
      quinigol: {
        game, drawDate: today,
        winningNumbers: [],
        results: ['1-2','0-1','2-0','1-1','3-1','0-2'],
      },
    };
    return mocks[game] ?? null;
  }

  async getDrawByDate(game: LotteryGame, _date: string): Promise<DrawResult | null> {
    return this.getLastDraw(game);
  }
}

// No hay un proveedor de resultados reales configurado todavía.
// El adaptador de ejemplo solo puede utilizarse mediante inyección explícita.
export const lotteryAdapter: LotteryApiAdapter = {
  isAvailable: () => false,
  getLastDraw: async () => null,
  getDrawByDate: async () => null,
};

export const LOTTERY_UNAVAILABLE_MESSAGE =
  'La comprobación de resultados reales todavía no está disponible. Puedes guardar el boleto y consultarlo con el operador del sorteo.';

// ─── CATEGORÍAS DE PREMIO ─────────────────────────────────────────
//
// Con los aciertos solo se sabe la CATEGORÍA (p. ej. «5+2» en Euromillones o «5+C» en Primitiva). El importe de
// cada categoría lo publica el operador oficial tras el sorteo y depende de la recaudación y de los acertantes:
// solo se da por confirmado si el sorteo trae ese importe (lottery_draws.prizes, cargado desde el backoffice).
// Nunca se calcula un importe a partir de los aciertos ni se dice «sin premio» si faltan datos del sorteo.

type LineEval = { category: string | null; complete: boolean };

function countMatches(userNums: number[], winNums: number[]): number {
  const set = new Set(winNums);
  return userNums.filter(n => set.has(n)).length;
}

const known = (v: unknown) => v != null && Number.isFinite(Number(v));

/** Euromillones: 13 categorías, de 5+2 a 2+0 (números + estrellas). */
function euromillones(line: LotteryLine, draw: DrawResult): LineEval {
  const complete = draw.winningNumbers.length === 5 && (draw.winningStars?.length ?? 0) === 2 && (line.stars?.length ?? 0) === 2;
  const key = `${countMatches(line.numbers, draw.winningNumbers)}+${countMatches(line.stars ?? [], draw.winningStars ?? [])}`;
  const cats = ['5+2', '5+1', '5+0', '4+2', '4+1', '3+2', '4+0', '2+2', '3+1', '3+0', '1+2', '2+1', '2+0'];
  return { category: complete && cats.includes(key) ? key : null, complete };
}

/**
 * Primitiva y Bonoloto: 6 · 5+C (el complementario del sorteo está entre los números de la apuesta) · 5 · 4 · 3 ·
 * R (reintegro). En Primitiva, 6 aciertos + reintegro es la categoría especial «6+R».
 */
function primitivaBonoloto(line: LotteryLine, draw: DrawResult, primitiva: boolean): LineEval {
  const n = countMatches(line.numbers, draw.winningNumbers);
  const hasComp = known(draw.complementario) && line.numbers.includes(Number(draw.complementario));
  const reintegroKnown = known(draw.reintegro) && known(line.reintegro);
  const hasRei = reintegroKnown && Number(draw.reintegro) === Number(line.reintegro);
  const complete = draw.winningNumbers.length === 6 && known(draw.complementario) && reintegroKnown;
  let category: string | null =
    n === 6 && primitiva && hasRei ? '6+R' :
    n === 6 ? '6' : n === 5 && hasComp ? '5+C' : n === 5 ? '5' : n === 4 ? '4' : n === 3 ? '3' : hasRei ? 'R' : null;
  // Sin el reintegro de la apuesta no se puede descartar el premio de reintegro
  if (category === null && !reintegroKnown) return { category: null, complete: false };
  if (draw.winningNumbers.length !== 6) category = null;
  return { category, complete };
}

/** El Gordo de la Primitiva: 5+1 … 2+0 (números + número clave) y reintegro (solo el número clave). */
function gordo(line: LotteryLine, draw: DrawResult): LineEval {
  const complete = draw.winningNumbers.length === 5 && known(draw.elKey) && known(line.elKey);
  const n = countMatches(line.numbers, draw.winningNumbers);
  const key = complete && Number(draw.elKey) === Number(line.elKey) ? 1 : 0;
  const category = !complete ? null : n >= 2 ? `${n}+${key}` : key ? 'R' : null;
  return { category, complete };
}

/** EuroDreams: 6+1 (número sueño), 6, 5, 4, 3, 2. */
function euroDreams(line: LotteryLine, draw: DrawResult): LineEval {
  const complete = draw.winningNumbers.length === 6 && (draw.winningStars?.length ?? 0) === 1;
  const n = countMatches(line.numbers, draw.winningNumbers);
  const dream = countMatches(line.stars ?? [], draw.winningStars ?? []) > 0;
  const category = !complete ? null : n === 6 ? (dream ? '6+1' : '6+0') : n >= 2 ? String(n) : null;
  return { category, complete };
}

/** Quiniela: categorías por aciertos de los 14 primeros partidos (14 · 13 · 12 · 11 · 10). El Pleno al 15 no se calcula. */
function quiniela(line: LotteryLine, draw: DrawResult): LineEval {
  const results = draw.results ?? [];
  const complete = results.length >= 14 && results.slice(0, 14).every(r => ['1', 'X', '2'].includes(String(r).toUpperCase()))
    && (line.picks?.length ?? 0) >= 14;
  if (!complete) return { category: null, complete: false };
  let matches = 0;
  for (let i = 0; i < 14; i++) if (String(line.picks![i]).toUpperCase().split('').includes(String(results[i]).toUpperCase())) matches++;
  return { category: matches >= 10 ? String(matches) : null, complete };
}

/** Juegos cuyo premio depende de listas oficiales que no se calculan aquí (Nacional, ONCE, Quinigol…). */
const UNSUPPORTED = 'Este juego se comprueba con la lista oficial del operador: Gol-Wallet no calcula sus premios.';

function evaluateLine(line: LotteryLine, draw: DrawResult): LotteryLineResult {
  const numMatch  = countMatches(line.numbers, draw.winningNumbers);
  const starMatch = countMatches(line.stars ?? [], draw.winningStars ?? []);
  let ev: LineEval | null;
  switch (draw.game) {
    case 'euromillones': ev = euromillones(line, draw); break;
    case 'primitiva':    ev = primitivaBonoloto(line, draw, true); break;
    case 'bonoloto':     ev = primitivaBonoloto(line, draw, false); break;
    case 'gordo':        ev = gordo(line, draw); break;
    case 'eurodreams':   ev = euroDreams(line, draw); break;
    case 'quiniela':     ev = quiniela(line, draw); break;
    default:             ev = null;
  }
  const amount = ev?.category != null ? draw.prizes?.[ev.category] : undefined;
  const prizeConfirmed = ev?.category != null && typeof amount === 'number' && Number.isFinite(amount) && amount >= 0;
  const outcome: SelectionResult = !ev ? 'unknown' : ev.category != null ? 'won' : ev.complete ? 'lost' : 'pending';
  return {
    lineIndex:   0,
    numbers:     line.numbers,
    stars:       line.stars,
    matches:     draw.game === 'quiniela' && ev?.category ? Number(ev.category) : numMatch,
    starMatches: starMatch,
    category:    ev?.category ?? null,
    prize:       prizeConfirmed ? amount : undefined,
    prizeConfirmed,
    outcome,
    note:        ev ? undefined : UNSUPPORTED,
  };
}

/** Estado del boleto a partir de sus líneas (ver LotteryPrizeStatus). */
export function lotteryPrizeStatus(lines: Pick<LotteryLineResult, 'outcome' | 'prizeConfirmed'>[]): LotteryPrizeStatus {
  const won = lines.filter(l => l.outcome === 'won');
  if (won.length) return won.every(l => l.prizeConfirmed) ? 'confirmed' : 'pending_amount';
  if (lines.length && lines.every(l => l.outcome === 'lost')) return 'no_prize';
  return lines.some(l => l.outcome === 'unknown') ? 'unsupported' : 'incomplete';
}

/** ¿Hay que volver a comprobar? Sin resultado, con datos incompletos, con importe pendiente o guardado antes de 0029. */
export function lotteryNeedsRecheck(result: { prizeStatus?: LotteryPrizeStatus } | null | undefined): boolean {
  return !result || !result.prizeStatus || result.prizeStatus === 'incomplete' || result.prizeStatus === 'pending_amount';
}

/** Aviso al tener el resultado. null = no avisar (faltan datos: se volverá a comprobar). */
export function lotteryNotice(name: string, result: { prizeStatus?: LotteryPrizeStatus; totalPrize: number; lineResults?: { category?: string | null }[] },
                              euro: (n: number) => string): { title: string; body: string } | null {
  const cats = [...new Set((result.lineResults ?? []).map(l => l.category).filter(Boolean))].join(', ');
  switch (result.prizeStatus) {
    case 'confirmed': return { title: `¡Premio en tu ${name}!`, body: `Importe oficial: ${euro(result.totalPrize)}.` };
    case 'pending_amount': return { title: `¡Premio en tu ${name}!`, body: `Categoría ${cats}. El importe oficial aún no está publicado: te lo mostraremos en cuanto lo esté.` };
    case 'no_prize': return { title: `Ya está el resultado de tu ${name}`, body: 'Esta vez no ha habido premio. Míralo en Boletos.' };
    default: return null;
  }
}

/**
 * Resultado que muestran las pantallas: 'won' (alguna categoría premiada, aunque falte el importe), 'lost' (sorteo
 * completo y ninguna categoría) o 'pending' (sin comprobar, datos incompletos o juego no soportado).
 * Acepta resultados guardados antes de este cambio (sin prizeStatus): solo eran fiables los importes > 0.
 */
export function lotteryResultOutcome(result: { prizeStatus?: LotteryPrizeStatus; totalPrize?: number } | null | undefined): 'won' | 'lost' | 'pending' {
  if (!result) return 'pending';
  if (!result.prizeStatus) return Number(result.totalPrize ?? 0) > 0 ? 'won' : 'pending';
  return result.prizeStatus === 'confirmed' || result.prizeStatus === 'pending_amount' ? 'won'
    : result.prizeStatus === 'no_prize' ? 'lost' : 'pending';
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────

export async function checkLotteryTicket(
  ticket: LotteryTicket,
  adapter: LotteryApiAdapter = lotteryAdapter,
): Promise<LotteryCheckResult | null> {
  if (!adapter.isAvailable()) return null;

  const draw = ticket.drawDate
    ? await adapter.getDrawByDate(ticket.game, ticket.drawDate)
    : await adapter.getLastDraw(ticket.game);

  if (!draw) return null;

  const lineResults: LotteryLineResult[] = ticket.lines.map((line, i) => ({
    ...evaluateLine(line, draw),
    lineIndex: i,
  }));

  // Solo importes oficiales confirmados; una categoría premiada sin importe suma 0 y queda en prizeStatus
  const totalPrize = Math.round(lineResults.reduce((sum, r) => sum + (r.prizeConfirmed ? r.prize ?? 0 : 0), 0) * 100) / 100;

  return {
    game:           ticket.game,
    drawDate:       draw.drawDate,
    winningNumbers: draw.winningNumbers,
    winningStars:   draw.winningStars,
    complementario: draw.complementario,
    reintegro:      draw.reintegro,
    results:        draw.results,
    lineResults,
    totalPrize,
    prizeStatus:    lotteryPrizeStatus(lineResults),
    prizesSource:   draw.prizesSource,
    checkedAt:      new Date().toISOString(),
  };
}
