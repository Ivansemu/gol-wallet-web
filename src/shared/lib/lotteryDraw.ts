// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Fila de la tabla lottery_draws (cargada desde el backoffice) → resultado que entiende el comprobador.
// extras: complementario, reintegro, estrellas (Euromillones), sueno (EuroDreams), clave (El Gordo),
// resultados (Quiniela: ['1','X','2',…]). Se aceptan también los nombres en inglés.
import type { LotteryGame } from '../types/tickets';
import type { DrawResult } from './lotteryChecker';

export type DrawRow = { game: string; draw_date: string; numbers: number[] | null; extras: Record<string, unknown> | null; prizes?: unknown };

/**
 * Importes oficiales por categoría. Formato de lottery_draws.prizes (docs/CONTRATOS.md en winzo-backend):
 * { categories: { '5+2': 1234567.8, … }, source: 'SELAE · acta', verified_at } — también se acepta { '5+2': 123, … }.
 * Solo números ≥ 0; cualquier otra cosa se ignora (sin importe, nunca un valor inventado).
 */
export function prizesFromRow(raw: unknown): { prizes?: Record<string, number>; source?: string } {
  if (!raw || typeof raw !== 'object') return {};
  const obj = raw as Record<string, unknown>;
  const cats = obj.categories && typeof obj.categories === 'object' ? obj.categories as Record<string, unknown> : obj;
  const prizes: Record<string, number> = {};
  for (const [k, v] of Object.entries(cats)) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v) ? Number(v) : NaN;
    if (Number.isFinite(n) && n >= 0) prizes[k] = Math.round(n * 100) / 100;
  }
  return { prizes: Object.keys(prizes).length ? prizes : undefined, source: typeof obj.source === 'string' ? obj.source : undefined };
}

const num = (v: unknown) => (v == null || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
const nums = (v: unknown) => (Array.isArray(v) ? v.map(Number).filter(n => !Number.isNaN(n)) : undefined);

export function drawFromRow(row: DrawRow): DrawResult {
  const x = row.extras ?? {};
  const dream = num(x.sueno ?? x.dream);
  const signs = x.resultados ?? x.results;
  return {
    game: row.game as LotteryGame,
    drawDate: row.draw_date.slice(0, 10),
    winningNumbers: row.numbers ?? [],
    winningStars: nums(x.estrellas ?? x.stars) ?? (dream != null ? [dream] : undefined),
    complementario: num(x.complementario),
    reintegro: num(x.reintegro),
    elKey: num(x.clave ?? x.elKey),
    results: Array.isArray(signs) ? signs.map(String) : undefined,
    ...(({ prizes, source }) => ({ prizes, prizesSource: source }))(prizesFromRow(row.prizes)),
  };
}
