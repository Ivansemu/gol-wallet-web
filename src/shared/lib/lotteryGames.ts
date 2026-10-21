// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Nombre, monograma y color de cada juego de lotería (diseño: «EM», «LP», «BL»…).
import type { LotteryGame } from '../types/tickets';
import { lotteryGameColors } from '../theme/tokens';

export const LOTTERY_GAMES: Record<LotteryGame, { name: string; short: string }> = {
  euromillones: { name: 'Euromillones', short: 'EM' },
  primitiva: { name: 'La Primitiva', short: 'LP' },
  bonoloto: { name: 'Bonoloto', short: 'BL' },
  gordo: { name: 'El Gordo', short: 'EG' },
  once: { name: 'ONCE', short: 'ON' },
  eurodreams: { name: 'EuroDreams', short: 'ED' },
  loteria_nacional: { name: 'Lotería Nacional', short: 'LN' },
  quiniela: { name: 'Quiniela', short: 'QN' },
  quinigol: { name: 'Quinigol', short: 'QG' },
  loto: { name: 'Loto', short: 'LO' },
  unknown_lottery: { name: 'Lotería', short: 'LT' },
};

export const gameName = (g?: string) => LOTTERY_GAMES[g as LotteryGame]?.name ?? 'Lotería';
export const gameShort = (g?: string) => LOTTERY_GAMES[g as LotteryGame]?.short ?? 'LT';
export const gameColor = (g?: string) => lotteryGameColors[g ?? ''] ?? lotteryGameColors.unknown_lottery;

/** Qué hay que elegir en cada juego para comprobar a mano (pantalla Comprobar · números). */
export type GameSpec =
  | { kind: 'balls'; pick: number; max: number; min?: number; extra?: { label: string; pick: number; min: number; max: number } }
  | { kind: 'number'; digits: number; series?: boolean }
  | { kind: 'signs'; matches: number; signs: string[] };

export const GAME_SPECS: Partial<Record<LotteryGame, GameSpec>> = {
  euromillones: { kind: 'balls', pick: 5, max: 50, extra: { label: 'Estrellas', pick: 2, min: 1, max: 12 } },
  primitiva: { kind: 'balls', pick: 6, max: 49, extra: { label: 'Reintegro', pick: 1, min: 0, max: 9 } },
  bonoloto: { kind: 'balls', pick: 6, max: 49, extra: { label: 'Reintegro', pick: 1, min: 0, max: 9 } },
  gordo: { kind: 'balls', pick: 5, max: 54, extra: { label: 'Número clave', pick: 1, min: 0, max: 9 } },
  eurodreams: { kind: 'balls', pick: 6, max: 40, extra: { label: 'Dream', pick: 1, min: 1, max: 5 } },
  once: { kind: 'number', digits: 5, series: true },
  loteria_nacional: { kind: 'number', digits: 5 },
  quiniela: { kind: 'signs', matches: 15, signs: ['1', 'X', '2'] },
  // Quinigol: goles de local y visitante en 6 partidos (12 casillas)
  quinigol: { kind: 'signs', matches: 12, signs: ['0', '1', '2', 'M'] },
};

/** Orden de la rejilla de juegos del diseño. */
export const CHECK_GAMES: LotteryGame[] = ['euromillones', 'primitiva', 'bonoloto', 'gordo', 'once', 'eurodreams', 'loteria_nacional', 'quiniela', 'quinigol'];
