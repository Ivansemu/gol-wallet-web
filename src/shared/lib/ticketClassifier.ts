// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// src/lib/ticketClassifier.ts
// Clasificador multi-etapa de boletos.
//
// RAÍZ DEL BUG ANTERIOR: el análisis de layout usaba un límite de 8 tokens
// por fila, que excluía líneas con combo# + 6 núms + C + R (9 tokens).
//
// v2 — Cambios clave:
//   · GAME_PROFILES.score: 30 → 80  (keyword de juego = señal casi definitiva)
//   · analyzeLotteryGrid: límite de fila ampliado a 5-12; líneas largas se
//     dividen en múltiples combinaciones; extracción de tokens más estricta
//   · Análisis de densidad numérica del documento
//   · Condición de veto: keyword de juego conocido + layout → lotería definitiva
//   · reclassifyIfNeeded: no requiere result.type='lottery'; usa puntuación absoluta

import type { LotteryGame } from '../types/tickets';

export type ClassifiedType = 'sports_bet' | 'lottery' | 'unknown';

export interface ClassificationResult {
  type: ClassifiedType;
  game?: LotteryGame;
  confidence: number;
  lotteryScore: number;
  sportsScore: number;
  details?: string;
}

// ─── PERFILES DE JUEGO ───────────────────────────────────────────────────────

const GAME_PROFILES: { game: LotteryGame; patterns: RegExp[]; score: number }[] = [
  { game: 'euromillones',    patterns: [/euromillones/i, /euromillion[s]?/i],                                     score: 80 },
  { game: 'primitiva',       patterns: [/\bprimitiva\b/i, /la\s+primitiva\b/i],                                  score: 80 },
  { game: 'bonoloto',        patterns: [/\bbonoloto\b/i],                                                         score: 80 },
  { game: 'gordo',           patterns: [/el\s+gordo\b/i, /gordo\s+de\s+la\s+primitiva/i],                        score: 80 },
  { game: 'once',            patterns: [/\bonce\b/i, /cup[oó]n\s+de\s+la\s+once/i, /c[uú]ponazzo/i],            score: 80 },
  { game: 'eurodreams',      patterns: [/\beurodreams?\b/i],                                                      score: 80 },
  { game: 'loteria_nacional',patterns: [/loter[ií]a\s+nacional\b/i, /loter[ií]a\s+de\s+navidad/i, /el\s+gordo\s+de\s+navidad/i], score: 80 },
  { game: 'quiniela',        patterns: [/\bquiniela\b/i, /\bjornada\s+n[uú]m/i],                                 score: 80 },
  { game: 'quinigol',        patterns: [/\bquinigol\b/i],                                                         score: 80 },
  { game: 'loto',            patterns: [/\bloto\b/i, /\bel\s+loto\b/i],                                          score: 60 },
];

// ─── SEÑALES DEFINITIVAS DE MARCA ───────────────────────────────────────────

const LOTTERY_BRANDS: { pattern: RegExp; game?: LotteryGame }[] = [
  { pattern: /\bSELAE\b/                                   },
  { pattern: /\bLAE\b/                                     },
  { pattern: /sociedad\s+estatal\s+de\s+loter[ií]as/i     },
  { pattern: /loter[ií]as\s+y\s+apuestas\s+del\s+estado/i },
  { pattern: /cup[oó]n\s+de\s+la\s+once/i,  game: 'once'  },
  { pattern: /fundaci[oó]n\s+once/i,         game: 'once'  },
];

const SPORTS_BRANDS: RegExp[] = [
  /\bsportium\b/i, /\bcodere\b/i,      /\bluckia\b/i,      /\badmiralbet\b/i,
  /\badmiral\b/i,  /\bbet365\b/i,      /\bbetway\b/i,      /\b1xbet\b/i,
  /\bbwin\b/i,     /\bbetfair\b/i,     /\bunibet\b/i,      /william\s+hill/i,
  /\binterwetten\b/i, /\bmarca\s*apuestas\b/i, /\bkirolbet\b/i,
  /\bvs\s*sports\b/i, /\bversus\b/i,   /\bcazé\s*sports?\b/i, /\bzebet\b/i,
  /apuestas\s+deportivas/i,
];

// ─── KEYWORDS DE DOCUMENTO ──────────────────────────────────────────────────

const LOTTERY_KEYWORDS: { pattern: RegExp; score: number }[] = [
  { pattern: /\breintegro\b/i,                   score: 22 },
  { pattern: /\bcomplementario\b/i,              score: 22 },
  { pattern: /\bfracci[oó]n\b/i,                score: 22 },
  { pattern: /\bd[eé]cimo\b/i,                  score: 22 },
  { pattern: /\bestrellas?\s+de\s+la\s+suerte\b/i, score: 18 },
  { pattern: /\bclave\s+del\s+gordo\b/i,         score: 18 },
  { pattern: /\bel\s+sue[ñn]o\b/i,              score: 18 },
  { pattern: /\bsorteo\b/i,                      score: 12 },
  { pattern: /\bjugada\b/i,                      score: 12 },
  { pattern: /\bcombinaci[oó]n\s+simple\b/i,    score: 16 },
  { pattern: /\bboleto\s+de\s+loter[ií]a\b/i,  score: 20 },
  { pattern: /\bn[uú]meros\s+premiados\b/i,     score: 16 },
  { pattern: /\bpremio\s+especial\b/i,           score: 14 },
  { pattern: /\bserie[s]?\b/i,                  score:  8 },
  { pattern: /\bjuego\s*:\s*bonoloto\b/i,        score: 30 }, // cabecera explícita
  { pattern: /\bjuego\s*:\s*primitiva\b/i,       score: 30 },
  { pattern: /\bjuego\s*:\s*euromillones\b/i,    score: 30 },
];

const SPORTS_KEYWORDS: { pattern: RegExp; score: number }[] = [
  { pattern: /apuesta[s]?\s+deportiva[s]?/i,    score: 24 },
  { pattern: /ganancia\s+m[aá]xima/i,            score: 20 },
  { pattern: /importe\s+apostado/i,              score: 20 },
  { pattern: /\b1X2\b/,                          score: 18 },
  { pattern: /doble\s+oportunidad/i,             score: 16 },
  { pattern: /\bhandicap\b/i,                    score: 14 },
  { pattern: /\bcuota[s]?\s+total/i,            score: 16 },
  { pattern: /\bapuesta\s+combinada\b/i,         score: 16 },
  { pattern: /m[aá]s\s+de\s+\d+[.,]\d+\s+goles/i, score: 14 },
  { pattern: /\bbtts\b/i,                        score: 14 },
  { pattern: /ambos\s+marcan/i,                  score: 14 },
  { pattern: /resultado\s+final/i,               score: 10 },
  { pattern: /\bpartido\s+de\b/i,               score:  8 },
  { pattern: /\bchampions\s+league\b/i,          score:  8 },
  { pattern: /\bla\s+liga\b/i,                   score:  8 },
  { pattern: /\bprimera\s+divisi[oó]n\b/i,      score:  8 },
];

// ─── ANÁLISIS DE GRID DE LOTERÍA ────────────────────────────────────────────
//
// FIX PRINCIPAL: el clasificador anterior usaba un límite superior de 8 tokens
// por fila. Una línea de Bonoloto con el número de combinación, 6 números
// principales, complementario y reintegro = 9 tokens → nunca se contaba.
//
// Mejoras v2:
//   · Extracción de tokens estricta: split por espacios + filtro /^\d{1,2}$/
//     Esto descarta de forma natural decimales "3.45", fechas "15/01",
//     precios "1,50" y marcadores "1:" sin necesitar lookbehind (no soportado
//     por el motor Hermes de React Native).
//   · Límite superior: 12 (era 8)
//   · Líneas largas (≥13 números): se cuentan como floor(n/6) combinaciones
//   · Se contabiliza el total de números tipo lotería en el documento

interface LotteryGridAnalysis {
  totalRows:            number;
  quinielaRows:         number;
  hasStarPattern:       boolean;
  hasReintegroPattern:  boolean;
  hasOncePattern:       boolean;
  totalLotteryNums:     number;
  lotteryScore:         number;
}

// Hermes (React Native) no soporta lookbehind. Usamos split por espacios y
// comprobamos que el token sea SOLO dígitos (1-2 chars). Esto excluye de forma
// natural: decimales "3.45", fechas "15/01", precios "1,50", marcadores "1:".
function extractLotteryNumsFromLine(line: string): number[] {
  return line
    .split(/\s+/)
    .filter(t => /^\d{1,2}$/.test(t))
    .map(Number)
    .filter(n => n >= 1 && n <= 54);
}

function analyzeLotteryGrid(text: string): LotteryGridAnalysis {
  const lines = text
    .split(/[\n\r]+/)
    .map(l => l.trim())
    .filter(l => l.length > 2);

  let totalRows            = 0;
  let quinielaRows         = 0;
  let hasStarPattern       = false;
  let hasReintegroPattern  = false;
  let hasOncePattern       = false;
  let totalLotteryNums     = 0;

  for (const line of lines) {
    // ── Quiniela: filas con picks 1/X/2 ────────────────────────────
    if (
      /(\d{1,2}[ªº°]?\s+[1X2]\s+){3,}/i.test(line) ||
      /\b[1X2]\s+[1X2]\s+[1X2]\b/.test(line)
    ) {
      quinielaRows++;
      continue;
    }

    // ── ONCE: número de 5 dígitos ───────────────────────────────────
    if (/\b\d{5}\b/.test(line) && !/\b\d{6,}\b/.test(line)) {
      hasOncePattern = true;
    }

    // ── Extraer números lotería aislados (1-2 dígitos, en rango 1-54) ─
    const rawNums = extractLotteryNumsFromLine(line);

    const count = rawNums.length;

    if (count >= 5) {
      if (count >= 13) {
        // Línea larga: probablemente varias combinaciones unidas (OCR)
        const combosInLine = Math.floor(count / 6);
        totalRows        += combosInLine;
        totalLotteryNums += count;
      } else {
        // Fila normal de 1 combinación (5-12 tokens) — FIX: era 5-8
        totalRows++;
        totalLotteryNums += count;

        // Patrón estrella: Euromillones / EuroDreams (7 nums con 2 pequeños)
        if (count === 7) {
          const smallNums = rawNums.filter(n => n >= 1 && n <= 12);
          if (smallNums.length >= 2) hasStarPattern = true;
        }

        // Patrón reintegro: último número ≤ 9 en combinación de ≥6
        if (count >= 6 && rawNums[rawNums.length - 1] <= 9) {
          hasReintegroPattern = true;
        }
      }
    } else if (count >= 2) {
      // Grupo pequeño (C 07, R 3, etc.): no es fila pero añade al total
      totalLotteryNums += count;
    }
  }

  // ── Puntuación del layout ────────────────────────────────────────
  let score = 0;
  if      (totalRows >= 4)  score += 65;
  else if (totalRows >= 3)  score += 55;
  else if (totalRows >= 2)  score += 38;
  else if (totalRows >= 1)  score += 18;

  // Total de números lotería en el documento (evidencia acumulada)
  if      (totalLotteryNums >= 24) score += 20; // ≥4 combinaciones
  else if (totalLotteryNums >= 12) score += 12; // ≥2 combinaciones

  if (quinielaRows >= 3)     score += 40;
  if (hasStarPattern)        score += 14;
  if (hasReintegroPattern)   score += 10;
  if (hasOncePattern)        score += 20;

  return {
    totalRows, quinielaRows,
    hasStarPattern, hasReintegroPattern, hasOncePattern,
    totalLotteryNums, lotteryScore: score,
  };
}

// ─── DETECCIÓN DE DENSIDAD NUMÉRICA ─────────────────────────────────────────
// Un boleto de lotería tiene alta densidad de números; uno deportivo, alta de texto.

function analyzeNumericDensity(text: string): number {
  const lines = text.split(/[\n\r]+/).filter(l => l.trim().length > 3);
  let numericLines = 0;
  let textLines    = 0;

  for (const line of lines) {
    const nums  = (line.match(/\b\d+\b/g) ?? []).length;
    const words = (line.match(/[A-Za-záéíóúüÁÉÍÓÚÜ]{4,}/g) ?? []).length;
    if (nums > words * 1.5 && nums >= 3) numericLines++;
    else if (words > 0)                   textLines++;
  }

  const ratio = numericLines / (textLines + 1);
  return ratio > 0.55 ? 12 : ratio > 0.30 ? 6 : 0;
}

// ─── DETECCIÓN DE CUOTAS DEPORTIVAS ─────────────────────────────────────────
// Distingue cuotas (1.95, 3.50) de precios de boleto (1,50 €).
// Las cuotas verdaderas aparecen en 5+ líneas distintas.

function analyzeOddsPatterns(text: string): number {
  const lines = text.split(/[\n\r]+/);
  let linesWithOdds = 0;

  for (const line of lines) {
    // Solo buscar patrones decimal con punto (no coma) — las cuotas en ES usan punto
    const matches = line.match(/\b[1-9]\d*\.\d{2}\b/g) ?? [];
    const valid   = matches.filter(raw => {
      const n = parseFloat(raw);
      return n >= 1.05 && n <= 99.0 && n !== Math.round(n);
    });
    if (valid.length >= 1) linesWithOdds++;
  }

  if (linesWithOdds >= 5) return 30;
  if (linesWithOdds >= 3) return 18;
  if (linesWithOdds >= 2) return 10;
  return 0;
}

// ─── DETECCIÓN DE NOMBRES DE EQUIPOS ────────────────────────────────────────

function analyzeTeamNames(text: string): number {
  const teamPattern = /\b[A-ZÁÉÍÓÚÜ][a-záéíóúü]{2,}(?:\s+[A-ZÁÉÍÓÚÜ][a-záéíóúü]{2,})*\s+[-—]\s+[A-ZÁÉÍÓÚÜ][a-záéíóúü]{2,}/g;
  const vsPattern   = /[A-ZÁÉÍÓÚÜ][a-záéíóúü]+\s+(?:vs\.?|versus)\s+[A-ZÁÉÍÓÚÜ][a-záéíóúü]+/gi;

  const teamMatches = (text.match(teamPattern) ?? []).length;
  const vsMatches   = (text.match(vsPattern)   ?? []).length;

  let score = 0;
  if      (teamMatches >= 3) score += 25;
  else if (teamMatches >= 2) score += 15;
  else if (teamMatches >= 1) score +=  8;
  if      (vsMatches   >= 2) score += 20;
  else if (vsMatches   >= 1) score += 10;

  return score;
}

// ─── ANÁLISIS DE CABECERA ────────────────────────────────────────────────────

function analyzeDocumentHeader(text: string): { lotteryScore: number; sportsScore: number; game?: LotteryGame } {
  const firstLines = text.split(/[\n\r]+/).slice(0, 6).join('\n');
  let lotteryScore = 0;
  let sportsScore  = 0;
  let game: LotteryGame | undefined;

  for (const gp of GAME_PROFILES) {
    for (const p of gp.patterns) {
      if (p.test(firstLines)) {
        lotteryScore += 20;
        if (!game) game = gp.game;
      }
    }
  }
  for (const p of SPORTS_BRANDS) {
    if (p.test(firstLines)) { sportsScore += 20; break; }
  }

  return { lotteryScore, sportsScore, game };
}

// ─── CLASIFICADOR PRINCIPAL ──────────────────────────────────────────────────

function detectGameFromText(text: string): LotteryGame | undefined {
  for (const gp of GAME_PROFILES) {
    for (const p of gp.patterns) {
      if (p.test(text)) return gp.game;
    }
  }
  return undefined;
}

export function classifyTicket(rawText: string): ClassificationResult {
  const text = rawText ?? '';
  if (!text.trim()) return { type: 'unknown', confidence: 0, lotteryScore: 0, sportsScore: 0 };

  let lotteryScore  = 0;
  let sportsScore   = 0;
  let detectedGame: LotteryGame | undefined;

  // ── Etapa 1: Marcas definitivas ─────────────────────────────────
  for (const brand of LOTTERY_BRANDS) {
    if (brand.pattern.test(text)) {
      lotteryScore += 100;
      if (brand.game && !detectedGame) detectedGame = brand.game;
    }
  }
  for (const p of SPORTS_BRANDS) {
    if (p.test(text)) { sportsScore += 80; break; }
  }

  if (lotteryScore >= 100 && sportsScore === 0) {
    const game = detectedGame ?? detectGameFromText(text);
    return { type: 'lottery', game, confidence: 0.97, lotteryScore, sportsScore };
  }
  if (sportsScore >= 80 && lotteryScore === 0) {
    return { type: 'sports_bet', confidence: 0.97, lotteryScore, sportsScore };
  }

  // ── Etapa 2: Keywords de documento ──────────────────────────────
  for (const sig of LOTTERY_KEYWORDS) {
    if (sig.pattern.test(text)) lotteryScore += sig.score;
  }
  for (const sig of SPORTS_KEYWORDS) {
    if (sig.pattern.test(text)) sportsScore += sig.score;
  }

  // ── Etapa 3: Keywords de juego específico (score 80 cada uno) ───
  for (const gp of GAME_PROFILES) {
    for (const p of gp.patterns) {
      if (p.test(text)) {
        lotteryScore += gp.score;
        if (!detectedGame) detectedGame = gp.game;
        break;
      }
    }
  }

  // ── Etapa 4: Grid de números lotería ────────────────────────────
  const layout = analyzeLotteryGrid(text);
  lotteryScore += layout.lotteryScore;

  if (layout.quinielaRows >= 3 && !detectedGame) detectedGame = 'quiniela';
  if (layout.hasOncePattern && !detectedGame)     detectedGame = 'once';

  // ── Etapa 4b: Densidad numérica del documento ───────────────────
  lotteryScore += analyzeNumericDensity(text);

  // ── Etapa 5: Cuotas deportivas ──────────────────────────────────
  const oddsScore = analyzeOddsPatterns(text);
  sportsScore    += oddsScore;

  // ── Etapa 6: Nombres de equipos ─────────────────────────────────
  sportsScore += analyzeTeamNames(text);

  // ── Etapa 7: Cabecera ────────────────────────────────────────────
  const header = analyzeDocumentHeader(text);
  lotteryScore += header.lotteryScore;
  sportsScore  += header.sportsScore;
  if (header.game && !detectedGame) detectedGame = header.game;

  // ── Correcciones anti-ruido ──────────────────────────────────────

  // Si hay filas de números de lotería Y ninguna marca deportiva → extra boost
  if (layout.totalRows >= 2 && !SPORTS_BRANDS.some(p => p.test(text))) {
    lotteryScore += 20;
  }

  // VETO: keyword de juego conocido + score alto → no dejar que señales débiles
  // deportivas anulen la evidencia clara de lotería.
  if (detectedGame && lotteryScore >= 80) {
    sportsScore = Math.min(sportsScore, lotteryScore - 30);
  }

  // ── Resultado final ──────────────────────────────────────────────
  const total      = lotteryScore + sportsScore;
  const confidence = total > 0 ? Math.max(lotteryScore, sportsScore) / total : 0;

  let type: ClassifiedType;
  if (total === 0) {
    type = 'unknown';
  } else if (lotteryScore >= sportsScore) {
    type = 'lottery';
    if (!detectedGame) detectedGame = detectGameFromText(text);
  } else {
    type = 'sports_bet';
  }

  return { type, game: detectedGame, confidence, lotteryScore, sportsScore };
}

// ─── RECLASIFICACIÓN ─────────────────────────────────────────────────────────
//
// El servidor puede clasificar mal. Este módulo local corrige el error.
// Cambio v2: el override de sports_bet→lottery ya no requiere que el clasificador
// local diga 'lottery'; basta con que lotteryScore sea alto (≥ VETO_SCORE),
// lo que significa que se encontró al menos un keyword de juego o layout fuerte.

const SPORTS_TO_LOTTERY_MIN_CONF  = 0.55;  // local classifier must be clearly confident
const SPORTS_TO_LOTTERY_VETO_SCORE= 80;   // only reached by explicit game keyword (each = 80 pts) or brand (100 pts)
const LOTTERY_TO_SPORTS_MIN_CONF  = 0.70;

export function reclassifyIfNeeded(
  serverType: string,
  rawText: string | undefined,
): { override: boolean; type: 'sports_bet' | 'lottery'; game?: LotteryGame } {
  if (!rawText) return { override: false, type: serverType as 'sports_bet' | 'lottery' };

  const result = classifyTicket(rawText);

  if (serverType === 'sports_bet') {
    // Override ONLY when local evidence clearly points to lottery in both confidence AND score.
    // The previous condition (lotteryScore >= 30) was a critical bug: it overrode correct
    // sports_bet classification whenever the ticket text contained ANY weak lottery-adjacent
    // word (e.g. "Serie A", "sorteo de desempate"), which is common in sports tickets.
    const shouldOverride =
      // Local classifier confidently says lottery AND lottery score actually beats sports score
      (result.type === 'lottery'
        && result.confidence >= SPORTS_TO_LOTTERY_MIN_CONF
        && result.lotteryScore > result.sportsScore) ||
      // Overwhelming lottery evidence: requires an actual game-keyword hit (≥80 pts each)
      // or a lottery brand (100 pts). Incidental matches never reach this threshold.
      result.lotteryScore >= SPORTS_TO_LOTTERY_VETO_SCORE;

    if (shouldOverride) {
      return { override: true, type: 'lottery', game: result.game };
    }
  }

  if (serverType === 'lottery' && result.type === 'sports_bet') {
    if (result.confidence >= LOTTERY_TO_SPORTS_MIN_CONF) {
      return { override: true, type: 'sports_bet' };
    }
  }

  return { override: false, type: serverType as 'sports_bet' | 'lottery' };
}
