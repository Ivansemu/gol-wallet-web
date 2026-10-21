// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// src/lib/lotteryTextExtractor.ts
// Extracción client-side de datos de lotería desde texto OCR crudo.
//
// Cuándo se usa:
//   1. El servidor clasifica mal el boleto (p.ej. devuelve sports_bet siendo lotería)
//   2. El servidor devuelve type=lottery pero lines=[] (sin combinaciones)
//   3. El servidor falla y queremos un resultado parcial
//
// La extracción es heurística: funciona bien con OCR limpio y razonablemente
// bien con OCR ruidoso. No reemplaza al servidor, lo complementa.

import type { LotteryGame, LotteryLine, LotteryTicket } from '../types/tickets';
import { classifyTicket } from './ticketClassifier';

// ─── HELPERS ──────────────────────────────────────────────────────

function parseInts(tokens: string[]): number[] {
  return tokens
    .map(t => parseInt(t.replace(/[^\d]/g, ''), 10))
    .filter(n => !isNaN(n) && n >= 1);
}

function extractDateFromText(text: string): string | undefined {
  // Formatos: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, "18 de mayo de 2025"
  const patterns = [
    /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
    /(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i,
    /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
  ];
  const months: Record<string, string> = {
    enero:'01', febrero:'02', marzo:'03', abril:'04',
    mayo:'05', junio:'06', julio:'07', agosto:'08',
    septiembre:'09', octubre:'10', noviembre:'11', diciembre:'12',
  };

  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    try {
      if (p === patterns[1]) {
        const month = months[m[2].toLowerCase()];
        if (month) return `${m[3]}-${month}-${m[1].padStart(2,'0')}`;
      } else if (p === patterns[2]) {
        return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
      } else {
        return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
      }
    } catch { continue; }
  }
  return undefined;
}

function extractStakeFromText(text: string): number | undefined {
  // Patrones: "Importe: 1,50 €", "1.50 EUR", "Precio: 2€"
  const patterns = [
    /(?:importe|precio|coste|total)[:\s]+(\d+[,.]?\d*)\s*[€eEuUrR]/i,
    /(\d+[,.]?\d*)\s*€/,
    /€\s*(\d+[,.]?\d*)/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      const n = parseFloat(m[1].replace(',', '.'));
      if (Number.isFinite(n) && n > 0 && n < 10000) return n;
    }
  }
  return undefined;
}

function extractDrawNumberFromText(text: string): string | undefined {
  const m = text.match(/sorteo\s+n[uú]m(?:ero)?\.?\s*(\d+)/i)
         ?? text.match(/n[uú]m(?:ero)?\s+de\s+sorteo[:\s]+(\d+)/i)
         ?? text.match(/sorteo[:\s]+(\d{3,6})/i);
  return m?.[1];
}

// ─── EXTRACTORES POR JUEGO ────────────────────────────────────────

function extractEuromillonesLines(text: string): LotteryLine[] {
  const lines: LotteryLine[] = [];
  const textLines = text.split(/[\n\r]+/);

  for (const line of textLines) {
    const tokens = line.trim().split(/\s+/);
    const allNums = parseInts(tokens).filter(n => n >= 1);

    // Patrón: 5 números (1-50) + 2 estrellas (1-12), separados visualmente
    // Puede venir en una sola línea: "3 14 23 34 45 * 2 9"
    // O en dos líneas: primera con 5 números, segunda con las estrellas

    const mainNums  = allNums.filter(n => n >= 1 && n <= 50);
    const starNums  = allNums.filter(n => n >= 1 && n <= 12);

    if (mainNums.length === 5) {
      const l: LotteryLine = { numbers: mainNums };
      // Buscar estrellas: números pequeños que no están en mainNums
      const usedSet = new Set(mainNums);
      const stars   = allNums.filter(n => n >= 1 && n <= 12 && !usedSet.has(n));
      if (stars.length === 2) l.stars = stars;
      if (l.numbers.length === 5) lines.push(l);
    }
  }

  // Agrupar pares de líneas (5 números + 2 estrellas en líneas separadas)
  if (!lines.length) {
    let i = 0;
    while (i < textLines.length - 1) {
      const line1 = parseInts(textLines[i].split(/\s+/)).filter(n => n >= 1 && n <= 50);
      const line2 = parseInts(textLines[i + 1].split(/\s+/)).filter(n => n >= 1 && n <= 12);
      if (line1.length === 5 && line2.length === 2) {
        lines.push({ numbers: line1, stars: line2 });
        i += 2;
      } else {
        i++;
      }
    }
  }

  return lines;
}

function extractPrimitivaLines(text: string): LotteryLine[] {
  const lines: LotteryLine[] = [];
  const textLines = text.split(/[\n\r]+/);

  for (const line of textLines) {
    const tokens = line.trim().split(/\s+/);
    const nums   = parseInts(tokens).filter(n => n >= 1 && n <= 49);

    if (nums.length === 6) {
      const entry: LotteryLine = { numbers: nums };

      // Buscar complementario y reintegro en la misma línea o la siguiente
      const extNums = parseInts(tokens);
      const compCand = extNums.filter(n => n >= 1 && n <= 49 && !nums.includes(n));
      if (compCand.length >= 1) entry.complementario = compCand[0];
      const reiCand = extNums.filter(n => n >= 0 && n <= 9 && n !== entry.complementario);
      if (reiCand.length >= 1) entry.reintegro = reiCand[reiCand.length - 1];

      lines.push(entry);
    }
  }
  return lines;
}

function extractBonolotoLines(text: string): LotteryLine[] {
  // Mismo formato que Primitiva: 6 números (1-49) + complementario + reintegro
  return extractPrimitivaLines(text);
}

function extractGordoLines(text: string): LotteryLine[] {
  const lines: LotteryLine[] = [];
  const textLines = text.split(/[\n\r]+/);

  for (const line of textLines) {
    const tokens = line.trim().split(/\s+/);
    const nums   = parseInts(tokens).filter(n => n >= 1 && n <= 54);

    if (nums.length === 5) {
      const entry: LotteryLine = { numbers: nums };
      // El Clave: número 1-9 al final
      const allNums = parseInts(tokens);
      const keyCand = allNums.filter(n => n >= 1 && n <= 9 && !nums.includes(n));
      if (keyCand.length >= 1) entry.elKey = keyCand[0];
      lines.push(entry);
    }
  }
  return lines;
}

function extractOnceLines(text: string): { lines: LotteryLine[]; onceNumber?: string; onceSeries?: string } {
  // ONCE: número de 5 dígitos + serie opcional
  const numMatch    = text.match(/\b(\d{5})\b/);
  const seriesMatch = text.match(/\bserie[:\s]+(\d{1,4})\b/i)
                   ?? text.match(/\b(\d{1,4})\b.*\bserie\b/i);

  if (!numMatch) return { lines: [] };

  const onceNum = numMatch[1];
  const line: LotteryLine = { numbers: [parseInt(onceNum, 10)] };

  return {
    lines:       [line],
    onceNumber:  onceNum,
    onceSeries:  seriesMatch?.[1],
  };
}

function extractEuroDreamsLines(text: string): LotteryLine[] {
  const lines: LotteryLine[] = [];
  const textLines = text.split(/[\n\r]+/);

  for (const line of textLines) {
    const tokens  = line.trim().split(/\s+/);
    const nums    = parseInts(tokens).filter(n => n >= 1 && n <= 40);
    const dreams  = parseInts(tokens).filter(n => n >= 1 && n <= 5);

    if (nums.length === 6) {
      const entry: LotteryLine = { numbers: nums };
      const usedSet = new Set(nums);
      const starCands = dreams.filter(n => !usedSet.has(n));
      if (starCands.length >= 1) entry.stars = [starCands[0]];
      lines.push(entry);
    }
  }
  return lines;
}

function extractQuinielaLines(text: string): LotteryLine[] {
  const lines: LotteryLine[] = [];
  const picks: string[] = [];

  // Buscar predicciones: "01 1  02 X  03 2  ..."
  const pickPattern = /\b\d{1,2}[ªº°]?\s+([1X2])\b/gi;
  let m: RegExpExecArray | null;
  while ((m = pickPattern.exec(text)) !== null) {
    picks.push(m[1].toUpperCase());
  }

  // Quiniela tiene 14-15 partidos
  if (picks.length >= 10) {
    lines.push({ numbers: [], picks });
  }
  return lines;
}

function extractLoteriaNacionalLines(text: string): LotteryLine[] {
  // Lotería Nacional: número de 5 dígitos + fracción + serie
  const numMatch      = text.match(/\b(\d{5})\b/);
  const fracMatch     = text.match(/fracci[oó]n[:\s]+(\d+)/i) ?? text.match(/\bfracc?[:\s.]+(\d+)\b/i);
  const seriesMatch   = text.match(/\bserie[:\s]+(\d{1,4})\b/i);

  if (!numMatch) return [];

  const line: LotteryLine = {
    numbers:  [parseInt(numMatch[1], 10)],
    fraction: fracMatch  ? parseInt(fracMatch[1],  10) : undefined,
    series:   seriesMatch? parseInt(seriesMatch[1], 10): undefined,
  };
  return [line];
}

// ─── TABLA DE EXTRACTORES ─────────────────────────────────────────

type Extractor = {
  game: LotteryGame;
  keywords: RegExp[];
  extract(text: string): { lines: LotteryLine[]; onceNumber?: string; onceSeries?: string };
};

const EXTRACTORS: Extractor[] = [
  {
    game: 'euromillones',
    keywords: [/euromillones/i, /euromillion/i],
    extract: t => ({ lines: extractEuromillonesLines(t) }),
  },
  {
    game: 'primitiva',
    keywords: [/\bprimitiva\b/i, /la\s+primitiva/i],
    extract: t => ({ lines: extractPrimitivaLines(t) }),
  },
  {
    game: 'bonoloto',
    keywords: [/bonoloto/i],
    extract: t => ({ lines: extractBonolotoLines(t) }),
  },
  {
    game: 'gordo',
    keywords: [/el\s+gordo/i, /gordo\s+de\s+la\s+primitiva/i],
    extract: t => ({ lines: extractGordoLines(t) }),
  },
  {
    game: 'once',
    keywords: [/\bonce\b/i, /cup[oó]n/i],
    extract: t => extractOnceLines(t),
  },
  {
    game: 'eurodreams',
    keywords: [/eurodreams/i],
    extract: t => ({ lines: extractEuroDreamsLines(t) }),
  },
  {
    game: 'loteria_nacional',
    keywords: [/loter[ií]a\s+nacional/i, /loter[ií]a\s+de\s+navidad/i, /\bd[eé]cimo\b/i],
    extract: t => ({ lines: extractLoteriaNacionalLines(t) }),
  },
  {
    game: 'quiniela',
    keywords: [/\bquiniela\b/i],
    extract: t => ({ lines: extractQuinielaLines(t) }),
  },
];

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────

/**
 * Extrae un LotteryTicket parcial desde texto OCR crudo.
 * Útil cuando el servidor falla o clasifica mal.
 *
 * @returns Un LotteryTicket parcial, o null si no se puede extraer nada.
 */
export function extractLotteryFromText(rawText: string): Partial<LotteryTicket> | null {
  if (!rawText?.trim()) return null;

  // Determinar juego
  let extractor: Extractor | undefined;
  for (const e of EXTRACTORS) {
    if (e.keywords.some(p => p.test(rawText))) { extractor = e; break; }
  }

  // Si no se reconoce por keyword, intentar por clasificador
  if (!extractor) {
    const cls = classifyTicket(rawText);
    if (cls.type !== 'lottery' || !cls.game) return null;
    extractor = EXTRACTORS.find(e => e.game === cls.game);
  }

  if (!extractor) return null;

  const extracted = extractor.extract(rawText);
  const drawDate  = extractDateFromText(rawText);
  const stake     = extractStakeFromText(rawText);
  const drawNumber= extractDrawNumberFromText(rawText);

  const ticket: Partial<LotteryTicket> = {
    type:        'lottery',
    game:        extractor.game,
    lines:       extracted.lines,
    drawDate,
    drawNumber,
    stake:       stake ?? 0,
    scannedAt:   new Date().toISOString(),
    _rawText:    rawText,
  };

  if (extracted.onceNumber) ticket.onceNumber = extracted.onceNumber;
  if (extracted.onceSeries) ticket.onceSeries = extracted.onceSeries;

  // Solo devolver si extraemos algo útil
  if (!extracted.lines.length && !ticket.onceNumber) return null;

  return ticket;
}

/**
 * Fusiona un ticket parcial extraído localmente con los datos del servidor.
 * El servidor tiene precedencia excepto en las lines (si el servidor no las tiene).
 */
export function mergeLotteryTicket(
  serverTicket: Partial<LotteryTicket>,
  localTicket: Partial<LotteryTicket>,
): LotteryTicket {
  const lines = serverTicket.lines?.length
    ? serverTicket.lines
    : (localTicket.lines ?? []);

  return {
    type:         'lottery',
    game:         serverTicket.game         ?? localTicket.game         ?? 'unknown_lottery',
    drawDate:     serverTicket.drawDate     ?? localTicket.drawDate,
    drawNumber:   serverTicket.drawNumber   ?? localTicket.drawNumber,
    issuedAt:     serverTicket.issuedAt     ?? localTicket.issuedAt,
    scannedAt:    serverTicket.scannedAt    ?? localTicket.scannedAt    ?? new Date().toISOString(),
    stake:        serverTicket.stake        ?? localTicket.stake        ?? 0,
    pricePerLine: serverTicket.pricePerLine ?? localTicket.pricePerLine,
    draws:        serverTicket.draws        ?? localTicket.draws        ?? 1,
    lines,
    onceNumber:   serverTicket.onceNumber   ?? localTicket.onceNumber,
    onceSeries:   serverTicket.onceSeries   ?? localTicket.onceSeries,
    _rawText:     serverTicket._rawText     ?? localTicket._rawText,
    _confidence:  serverTicket._confidence  ?? localTicket._confidence,
  };
}
