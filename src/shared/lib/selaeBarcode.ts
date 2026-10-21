// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// src/lib/selaeBarcode.ts
// Decodifica el código de barras de los resguardos de Loterías y Apuestas del Estado (SELAE).
//
// Ejemplos reales (sorteos del jueves 25/06/2026):
//   Bonoloto   A=1314402020130330239145434698153065;P=2;S=17625JUN26:1;W=0;.1=062022233949.2=011228394546;T=50555-0;R=9;
//   Primitiva  A=1314401020223626279066553734832158;P=1;S=07625JUN26:1;W=0;.1=122332334249;T=50555-0;R=5;J=NO;
//   EuroDreams A=1314414021329113410988690224849031;P=14;S=05125JUN26:1;W=0;.1=101723253036:03;T=50555-0;
//
//   A  → identificador único del resguardo
//   P  → código de juego (1 Primitiva, 2 Bonoloto, 14 EuroDreams)
//   S  → <nº de sorteo del año><DDMMMAA>:<nº de sorteos>   p. ej. 076 · 25JUN26 · 1
//   .N → columna N, números de 2 cifras concatenados; tras ':' los extra (Dream)
//   R  → reintegro
//   J  → Joker ('NO' si no se juega)
//   T  → terminal / punto de venta (no se usa)
//   W  → desconocido (no se usa)

import type { LotteryGame, LotteryLine, LotteryTicket } from '../types/tickets';

// Solo códigos verificados con boletos reales. Añadir aquí al confirmar otros juegos
// (pendientes: Euromillones, El Gordo).
const GAME_CODES: Record<string, LotteryGame> = {
  '1':  'primitiva',
  '2':  'bonoloto',
  '14': 'eurodreams',
};

// Precio del Joker por sorteo (Primitiva). Formato con Joker aún sin verificar.
const JOKER_PRICE = 1;

// Formato de cada juego: cuántos números, rango y precio por apuesta (€).
const GAME_RULES: Partial<Record<LotteryGame, { count: number; max: number; stars?: { count: number; max: number }; price: number }>> = {
  bonoloto:     { count: 6, max: 49, price: 0.5 },
  primitiva:    { count: 6, max: 49, price: 1 },
  euromillones: { count: 5, max: 50, stars: { count: 2, max: 12 }, price: 2.5 },
  gordo:        { count: 5, max: 54, price: 1.5 },
  eurodreams:   { count: 6, max: 40, stars: { count: 1, max: 5 }, price: 2.5 },
};

const MONTHS: Record<string, number> = {
  ENE: 1, JAN: 1, FEB: 2, MAR: 3, ABR: 4, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AGO: 8, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DIC: 12, DEC: 12,
};

export type SelaeBarcode = {
  ticketId?: string;
  gameCode?: string;
  game: LotteryGame;
  drawDate?: string;   // AAAA-MM-DD
  drawNumber?: string; // nº de sorteo del año, p. ej. "076"
  draws: number;
  columns: string[];   // valor crudo de cada columna
  reintegro?: number;
  joker?: string;      // número del Joker si se jugó
};

/** ¿Parece un código de resguardo SELAE? */
export function isSelaeBarcode(raw: string): boolean {
  return /(^|;)A=\d+/.test(raw) && /\.1=\d/.test(raw);
}

function pairs(digits: string): number[] {
  const out: number[] = [];
  for (let i = 0; i + 1 < digits.length; i += 2) out.push(parseInt(digits.slice(i, i + 2), 10));
  return out;
}

function parseDraw(value?: string): { drawDate?: string; drawNumber?: string; draws: number } {
  const m = value?.trim().toUpperCase().match(/^(\d{3})?(\d{2})([A-Z]{3})(\d{2})(?::(\d+))?$/);
  if (!m) return { draws: 1 };
  const [, drawNumber, dd, mon, yy, n] = m;
  const month = MONTHS[mon];
  const draws = n ? Math.max(1, parseInt(n, 10)) : 1;
  if (!month) return { drawNumber, draws };
  return { drawDate: `20${yy}-${String(month).padStart(2, '0')}-${dd}`, drawNumber, draws };
}

/** Lee los campos del código sin interpretar el juego. */
export function parseSelaeBarcode(raw: string): SelaeBarcode | null {
  if (!raw || !isSelaeBarcode(raw)) return null;

  const fields: Record<string, string> = {};
  for (const m of raw.matchAll(/(?:^|;)\s*([A-Z])=([^;]*)/g)) fields[m[1]] = m[2].trim();

  // Las columnas pueden ir seguidas sin ';' (".1=...".2=...")
  const columns: string[] = [];
  for (const m of raw.matchAll(/\.(\d+)=([0-9*+/:]+)/g)) columns[parseInt(m[1], 10) - 1] = m[2];

  const { drawDate, drawNumber, draws } = parseDraw(fields.S);
  const rei = fields.R != null && /^\d$/.test(fields.R) ? parseInt(fields.R, 10) : undefined;
  const joker = fields.J && /^\d+$/.test(fields.J) ? fields.J : undefined;

  return {
    ticketId: fields.A || undefined,
    gameCode: fields.P || undefined,
    game:     (fields.P && GAME_CODES[fields.P]) || 'unknown_lottery',
    drawDate,
    drawNumber,
    draws,
    columns:  columns.filter(Boolean),
    reintegro: rei,
    joker,
  };
}

function validNumbers(nums: number[], count: number, max: number): boolean {
  return nums.length === count
    && nums.every(n => Number.isInteger(n) && n >= 1 && n <= max)
    && new Set(nums).size === nums.length;
}

// El código P verificado manda; la pista (juego detectado en el texto del
// resguardo) solo se usa para códigos P aún desconocidos.
function resolveGame(code: SelaeBarcode, gameHint?: LotteryGame): LotteryGame {
  if (code.game !== 'unknown_lottery') return code.game;
  return gameHint ?? 'unknown_lottery';
}

/** Convierte el código en un boleto. Devuelve null si las columnas no cuadran con el juego. */
export function selaeBarcodeToTicket(raw: string, gameHint?: LotteryGame): LotteryTicket | null {
  const code = parseSelaeBarcode(raw);
  if (!code || !code.columns.length) return null;

  const game  = resolveGame(code, gameHint);
  const rules = GAME_RULES[game];
  if (!rules) return null;

  const lines: LotteryLine[] = [];
  for (const col of code.columns) {
    const [main, extra] = col.split(/[*+/:]/);
    const numbers = pairs(main);
    if (!validNumbers(numbers, rules.count, rules.max)) return null;
    const line: LotteryLine = { numbers };
    if (rules.stars) {
      const stars = pairs(extra ?? '');
      if (!validNumbers(stars, rules.stars.count, rules.stars.max)) return null;
      line.stars = stars;
    }
    if (code.reintegro != null) line.reintegro = code.reintegro;
    lines.push(line);
  }

  const jokerCost = code.joker ? JOKER_PRICE * code.draws : 0;
  const stake = Math.round((rules.price * lines.length * code.draws + jokerCost) * 100) / 100;
  return {
    type:         'lottery',
    game,
    drawDate:     code.drawDate,
    drawNumber:   code.drawNumber,
    ticketId:     code.ticketId,
    joker:        code.joker,
    scannedAt:    new Date().toISOString(),
    stake,
    pricePerLine: rules.price,
    draws:        code.draws,
    lines,
    _rawText:     raw,
    _confidence:  0.99,
  };
}

export type SelaeReadResult =
  | { ok: true; ticket: LotteryTicket }
  | { ok: false; reason: 'not_selae' | 'unsupported_game' | 'invalid' };

/** Igual que selaeBarcodeToTicket, pero indica por qué no se pudo leer (para mensajes al usuario). */
export function readSelaeCode(raw: string, gameHint?: LotteryGame): SelaeReadResult {
  const code = parseSelaeBarcode(raw);
  if (!code) return { ok: false, reason: 'not_selae' };
  if (!GAME_RULES[resolveGame(code, gameHint)]) return { ok: false, reason: 'unsupported_game' };
  const ticket = selaeBarcodeToTicket(raw, gameHint);
  return ticket ? { ok: true, ticket } : { ok: false, reason: 'invalid' };
}
