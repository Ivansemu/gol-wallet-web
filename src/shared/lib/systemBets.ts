// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Calculadora de apuestas de sistema (trixie, yankee, lucky 15…): funciones puras, sin red.
// Separada de outcome.ts para que la app no empaquete el cliente de API-Football ni su clave.

export type SystemBetType =
  | 'single'
  | 'combo'
  | 'trixie'   // 3 sel: 3 dobles + 1 triple = 4
  | 'patent'   // 3 sel: 3 simples + 3 dobles + 1 triple = 7
  | 'yankee'   // 4 sel: 6 dobles + 4 triples + 1 cuádruple = 11
  | 'lucky15'  // 4 sel: 4 + 6 + 4 + 1 = 15
  | 'canadian' // 5 sel: 26
  | 'heinz'    // 6 sel: 57
  | 'superheinz' // 7 sel: 120
  | 'goliath'; // 8 sel: 247

/** ¿El tipo de apuesta del boleto es un sistema (trixie, yankee…, o «sistema» sin más)? */
export const isSystemBet = (betType?: string | null) => /sistema|system|trixie|patent|yankee|lucky|canadian|heinz|goliath/i.test(betType ?? '');

function getCombinations<T>(arr: T[], size: number): T[][] {
  if (size === 1) return arr.map((x) => [x]);
  const result: T[][] = [];
  for (let i = 0; i <= arr.length - size; i++) {
    const rest = getCombinations(arr.slice(i + 1), size - 1);
    for (const r of rest) result.push([arr[i], ...r]);
  }
  return result;
}

function getSystemSizes(type: SystemBetType, n: number): number[] {
  switch (type) {
    case 'single': return [1];
    case 'combo': return [n];
    case 'trixie': return [2, 3];
    case 'patent': return [1, 2, 3];
    case 'yankee': return [2, 3, 4];
    case 'lucky15': return [1, 2, 3, 4];
    case 'canadian': return [2, 3, 4, 5];
    case 'heinz': return [2, 3, 4, 5, 6];
    case 'superheinz': return [2, 3, 4, 5, 6, 7];
    case 'goliath': return [2, 3, 4, 5, 6, 7, 8];
    default: return [n];
  }
}

export interface SystemBetResult {
  totalStake: number;
  maxWin: number;
  currentReturn: number;
  linesWon: number;
  linesTotal: number;
}

export function calculateSystemBet(
  selections: { odds: number; won?: boolean }[],
  type: SystemBetType,
  stakePerLine: number
): SystemBetResult {
  const n = selections.length;
  const sizes = getSystemSizes(type, n);

  const allCombos = sizes.flatMap((size) => getCombinations(selections, size));

  let maxWin = 0;
  let currentReturn = 0;
  let linesWon = 0;

  for (const combo of allCombos) {
    const combinedOdds = combo.reduce((acc, sel) => acc * sel.odds, 1);
    const lineWin = combinedOdds * stakePerLine;
    maxWin += lineWin;
    if (combo.every((sel) => sel.won === true)) {
      currentReturn += lineWin;
      linesWon++;
    }
  }

  return {
    totalStake: allCombos.length * stakePerLine,
    maxWin,
    currentReturn,
    linesWon,
    linesTotal: allCombos.length,
  };
}
