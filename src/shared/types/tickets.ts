// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// src/types/tickets.ts
// Tipos canónicos para todos los boletos que maneja Gol-Wallet.

// ─── APUESTAS DEPORTIVAS ─────────────────────────────────────────

export type SportsBetEvent = {
  sport?: string;
  index?: number;
  home?: string;
  away?: string;
  league?: string;
  competition?: string;
  market?: string;
  pick?: string;
  odds?: number;
  startTime?: string;
  /** Partido del boleto (1, 2…): varias selecciones del mismo partido («Crear apuesta») comparten número. */
  group?: number;
};

export type SportsBetTicket = {
  type: 'sports_bet';
  operator: string;
  ticketId?: string;
  betType?: string;
  stake: number;
  maxWin: number;
  finalOdds?: number;
  issuedAt?: string;
  scannedAt: string;
  events: SportsBetEvent[];
  _rawText?: string;
  _confidence?: number;
};

// ─── LOTERÍA ──────────────────────────────────────────────────────

export type LotteryGame =
  | 'bonoloto'
  | 'euromillones'
  | 'primitiva'
  | 'gordo'
  | 'once'
  | 'eurodreams'
  | 'loteria_nacional'
  | 'quiniela'
  | 'quinigol'
  | 'loto'
  | 'unknown_lottery';

export type LotteryLine = {
  numbers: number[];
  picks?: string[];            // Quiniela: ['1', 'X', '2', ...]
  stars?: number[];            // Euromillones, EuroDreams
  complementario?: number;    // Bonoloto / Primitiva
  reintegro?: number;         // Bonoloto / Primitiva
  elKey?: number;             // El Gordo
  fraction?: number;          // Lotería Nacional
  series?: number;            // Lotería Nacional / ONCE
};

export type LotteryTicket = {
  type: 'lottery';
  game: LotteryGame;
  drawDate?: string;
  drawNumber?: string;
  ticketId?: string;          // identificador del resguardo (código de barras SELAE)
  joker?: string;             // número del Joker (Primitiva), si se jugó
  issuedAt?: string;
  scannedAt: string;
  stake: number;
  pricePerLine?: number;
  draws?: number;
  lines: LotteryLine[];
  onceNumber?: string;
  onceSeries?: string;
  _rawText?: string;
  _confidence?: number;
};

// ─── UNIÓN ────────────────────────────────────────────────────────

export type ScannedTicket = SportsBetTicket | LotteryTicket;

// ─── RESULTADO DE VERIFICACIÓN ────────────────────────────────────

export type SelectionResult = 'won' | 'lost' | 'pending' | 'unknown';

export type LotteryLineResult = {
  lineIndex: number;
  numbers: number[];
  stars?: number[];
  matches: number;
  starMatches?: number;
  /** Categoría de premio calculada con los aciertos ('5+2', '5+C', 'R'…); null = ninguna o no se puede saber. */
  category?: string | null;
  /** Importe oficial de la categoría, solo si el sorteo lo trae (prizeConfirmed). */
  prize?: number;
  prizeConfirmed?: boolean;
  /** won = categoría premiada · lost = sorteo completo sin premio · pending = faltan datos · unknown = juego no soportado */
  outcome: SelectionResult;
  note?: string;
};

/**
 * confirmed      → hay premio y todos los importes son oficiales
 * pending_amount → hay categoría premiada pero falta el importe oficial
 * no_prize       → sorteo completo y ninguna línea premiada
 * incomplete     → faltan datos del sorteo o del boleto para decidir
 * unsupported    → juego cuyos premios no calcula Gol-Wallet (Nacional, ONCE…)
 */
export type LotteryPrizeStatus = 'confirmed' | 'pending_amount' | 'no_prize' | 'incomplete' | 'unsupported';

export type LotteryCheckResult = {
  /** Comprobado con los sorteos del servidor (se conserva al reabrir la app). */
  verified?: boolean;
  game: LotteryGame;
  drawDate: string;
  winningNumbers: number[];
  winningStars?: number[];
  complementario?: number;
  reintegro?: number;
  results?: string[];            // Quiniela/Quinigol: draw result array ['1','X','2',...]
  lineResults: LotteryLineResult[];
  /** Suma de importes OFICIALES confirmados (0 si no hay ninguno confirmado, aunque haya premio). */
  totalPrize: number;
  /** Falta en resultados guardados antes de 0029: usar lotteryResultOutcome(). */
  prizeStatus?: LotteryPrizeStatus;
  prizesSource?: string;
  checkedAt: string;
};

// ─── RESPUESTA RAW DEL SERVIDOR OCR ──────────────────────────────

export type OcrServerResponse =
  | (SportsBetTicket & { type: 'sports_bet' })
  | (LotteryTicket   & { type: 'lottery' })
  | { type: 'unknown'; _rawText: string; _confidence: number; error?: string };
