// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// src/lib/ticketParser.ts
// Convierte la respuesta raw del servidor OCR en un ScannedTicket tipado.
// Aplica reclasificación local y usa el extractor de texto como fallback.

import type {
  ScannedTicket,
  SportsBetTicket,
  SportsBetEvent,
  LotteryTicket,
  LotteryGame,
  LotteryLine,
  OcrServerResponse,
} from '../types/tickets';
import { classifyTicket, reclassifyIfNeeded } from './ticketClassifier';
import { extractLotteryFromText, mergeLotteryTicket } from './lotteryTextExtractor';

// ─── HELPERS ──────────────────────────────────────────────────────

function safeNum(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function safeStr(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function safeArr<T>(v: unknown): T[] {
  return Array.isArray(v) ? v : [];
}

function canonicalOperator(raw: string): string {
  const map: Record<string, string> = {
    sportium: 'Sportium', codere: 'Codere', versus: 'Versus',
    luckia: 'Luckia', admiral: 'Admiral', admiralbet: 'Admiral',
    bet365: 'Bet365', 'william hill': 'William Hill', betway: 'Betway',
    '1xbet': '1xBet', bwin: 'Bwin', betfair: 'Betfair',
    unibet: 'Unibet', interwetten: 'Interwetten',
    marcaapuestas: 'Marca Apuestas', 'marca apuestas': 'Marca Apuestas',
    kirolbet: 'Kirolbet', zebet: 'ZeBet',
  };
  const lower = raw.toLowerCase().trim();
  return map[lower] ?? raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const VALID_LOTTERY_GAMES: LotteryGame[] = [
  'bonoloto', 'euromillones', 'primitiva', 'gordo',
  'once', 'eurodreams', 'loteria_nacional',
  'quiniela', 'quinigol', 'loto', 'unknown_lottery',
];

function canonicalGame(raw: unknown): LotteryGame {
  const s = String(raw ?? '').toLowerCase().replace(/\s+/g, '_');
  return (VALID_LOTTERY_GAMES.includes(s as LotteryGame) ? s : 'unknown_lottery') as LotteryGame;
}

// ─── PARSEO DE EVENTO DEPORTIVO ───────────────────────────────────

/** Pago anticipado que marca el OCR (earlyPayout: 2) → «(2GV)» en el mercado, que es lo que detecta el backend. */
function withEarlyPayout(market: string | undefined, e: any): string | undefined {
  const lead = safeNum(e.earlyPayout ?? e.early_payout ?? e.leadPayout);
  if (!lead || lead < 1 || /\b\d?\s*(gv|vg)\b|ventaja|anticipad|early payout/i.test(market ?? '')) return market;
  return `${market || 'Resultado final'} (${Math.round(lead)}GV)`;
}

function parseEvent(e: any, i: number): SportsBetEvent {
  const parsed = parseEventFields(e, i);
  return { ...parsed, market: withEarlyPayout(parsed.market, e) };
}

function parseEventFields(e: any, i: number): SportsBetEvent {
  return {
    sport:     safeStr(e.sport ?? e.sportName ?? e.deporte),
    index:     safeNum(e.index) ?? i,
    home:      safeStr(e.home ?? e.homeTeam ?? e.localTeam ?? e.local ??
                        e.equipo1 ?? e.team1 ?? e.teamHome ?? e.equipoLocal),
    away:      safeStr(e.away ?? e.awayTeam ?? e.visitorTeam ?? e.visitante ??
                        e.equipo2 ?? e.team2 ?? e.teamAway ?? e.equipoVisitante),
    league:    safeStr(e.league ?? e.competition ?? e.competicion ??
                        e.liga ?? e.torneo ?? e.tournament ?? e.categoria),
    market:    safeStr(e.market ?? e.marketName ?? e.mercado ??
                        e.tipo ?? e.tipoApuesta ?? e.tipoBet ?? e.betType),
    pick:      safeStr(e.pick ?? e.selection ?? e.seleccion ??
                        e.pronostico ?? e.prediction ?? e.resultado ?? e.outcome),
    odds:      safeNum(e.odds ?? e.cuota ?? e.quota ?? e.odd ?? e.cuotaSeleccion),
    startTime: safeStr(e.startTime ?? e.date ?? e.kickoff ??
                        e.fecha ?? e.hora ?? e.matchTime ?? e.horaInicio),
    group:     safeNum(e.group ?? e.matchGroup ?? e.partido),
  };
}

/**
 * Selecciones del mismo partido (mismo group): lo que se lee en una vale para las demás. Si en una salió el rival
 * y en otra no («Real Betis - ?»), se completa; igual con la hora y la competición. No inventa nada que no esté.
 */
export function fillGroupTeams(events: SportsBetEvent[]): SportsBetEvent[] {
  const byGroup = new Map<number, SportsBetEvent[]>();
  for (const e of events) if (e.group != null) byGroup.set(e.group, [...(byGroup.get(e.group) ?? []), e]);
  return events.map(e => {
    const sibs = e.group != null ? byGroup.get(e.group) ?? [] : [];
    if (sibs.length < 2) return e;
    const first = (k: 'home' | 'away' | 'startTime' | 'league' | 'sport') => e[k] ?? sibs.find(x => x[k])?.[k];
    return { ...e, home: first('home'), away: first('away'), startTime: first('startTime'), league: first('league'), sport: first('sport') };
  });
}

// ─── PARSEO APUESTA DEPORTIVA ─────────────────────────────────────

/**
 * El OCR se inventa el año cuando el boleto no lo imprime ("2023-09-30 18:45" en 2026).
 * Deja día, mes y hora, y pone el año más cercano a la fecha de escaneo.
 */
export function fixOcrYear(value: string | undefined, reference: string): string | undefined {
  const m = value?.match(/^(\d{4})(-\d{2}-\d{2})/);
  const ref = new Date(reference);
  if (!value || !m || !Number.isFinite(ref.getTime())) return value;
  const shifted = (year: number) => `${year}${value.slice(4)}`;
  const distance = (v: string) => { const t = Date.parse(v.slice(0, 10)); return Number.isFinite(t) ? Math.abs(t - ref.getTime()) : Infinity; };
  const y = ref.getFullYear();
  const best = [y - 1, y, y + 1].map(shifted).reduce((a, b) => distance(b) < distance(a) ? b : a, value);
  return distance(value) - distance(best) > 120 * 864e5 ? best : value;
}

export function parseSportsBet(raw: any): SportsBetTicket {
  const operator = canonicalOperator(
    safeStr(raw.operator ?? raw.header?.operator ?? raw.bookmaker) ?? 'Operador'
  );
  const scannedAt = safeStr(raw.scannedAt) ?? new Date().toISOString();
  const events: SportsBetEvent[] = fillGroupTeams(safeArr<any>(raw.events).map((event, index) => {
    const parsed = parseEvent({ ...event, sport: event.sport ?? event.sportName ?? event.deporte ?? raw.sport ?? raw.deporte }, index);
    return { ...parsed, startTime: fixOcrYear(parsed.startTime, scannedAt) };
  }));

  return {
    type:      'sports_bet',
    operator,
    ticketId:  safeStr(
      raw.ticketId ?? raw.betId ?? raw.header?.betId ??
      raw.id ?? raw.codigo ?? raw.referencia ?? raw.ticketCode ?? raw.apuestaId
    ),
    betType: safeStr(
      raw.betType ?? raw.header?.betType ??
      raw.tipo ?? raw.tipoApuesta ?? raw.modalidad ?? raw.betMode
    ),
    stake: safeNum(
      raw.stake ?? raw.stakeEUR ?? raw.header?.stakeEUR ??
      raw.importe ?? raw.totalApostado ?? raw.apostado ??
      raw.amount ?? raw.totalStake ?? raw.betAmount ?? raw.importeApostado
    ) ?? 0,
    maxWin: safeNum(
      raw.maxWin ?? raw.potentialWinEUR ?? raw.header?.potentialWinEUR ??
      raw.ganancia ?? raw.gananciaMaxima ?? raw.premioMaximo ??
      raw.potentialWin ?? raw.retorno ?? raw.winnings ??
      raw.payout ?? raw.possibleWin ?? raw.beneficioPotencial
    ) ?? 0,
    finalOdds: safeNum(
      raw.finalOdds ?? raw.header?.finalOdds ??
      raw.cuotaTotal ?? raw.cuotaCombinada ?? raw.totalOdds ??
      raw.combinedOdds ?? raw.cuotaFinal ?? raw.oddTotal
    ),
    issuedAt: fixOcrYear(safeStr(
      raw.issuedAt ?? raw.header?.placedAtISO ??
      raw.fecha ?? raw.date ?? raw.placedAt ?? raw.timestamp ?? raw.fechaApuesta
    ), scannedAt),
    scannedAt,
    events,
    _rawText:    safeStr(raw._rawText),
    _confidence: safeNum(raw._confidence ?? raw._ocr?.confidence),
  };
}

// ─── PARSEO LÍNEA DE LOTERÍA ──────────────────────────────────────

function parseLotteryLine(l: any): LotteryLine {
  const numbers: number[] = safeArr<number>(l.numbers).map(Number).filter(n => n > 0);
  const picks: string[]   = safeArr<string>(l.picks).map(String).filter(Boolean);

  return {
    numbers,
    picks:          picks.length ? picks : undefined,
    stars:          safeArr<number>(l.stars).map(Number).filter(n => n > 0),
    complementario: safeNum(l.complementario),
    reintegro:      safeNum(l.reintegro),
    elKey:          safeNum(l.elKey ?? l.key),
    fraction:       safeNum(l.fraction),
    series:         safeNum(l.series),
  };
}

// ─── PARSEO LOTERÍA ───────────────────────────────────────────────

export function parseLottery(raw: any): LotteryTicket {
  const rawText  = safeStr(raw._rawText);
  let lines: LotteryLine[] = safeArr<any>(raw.lines).map(parseLotteryLine);

  // Si el servidor no devuelve líneas estructuradas, intentar con números crudos
  if (!lines.length && Array.isArray(raw.numbers) && raw.numbers.length) {
    lines.push(parseLotteryLine({ numbers: raw.numbers, stars: raw.stars ?? [] }));
  }

  // Si todavía sin líneas, usar extractor local sobre el texto crudo
  if (!lines.length && rawText) {
    const local = extractLotteryFromText(rawText);
    if (local?.lines?.length) lines = local.lines;
  }

  const game = canonicalGame(raw.game);

  return {
    type:        'lottery',
    game,
    drawDate:    safeStr(raw.drawDate  ?? raw.issuedAt),
    drawNumber:  safeStr(raw.drawNumber),
    issuedAt:    safeStr(raw.issuedAt  ?? raw.drawDate),
    scannedAt:   safeStr(raw.scannedAt) ?? new Date().toISOString(),
    stake:       safeNum(raw.stake ?? raw.price ?? raw.importe) ?? 0,
    pricePerLine: safeNum(raw.pricePerLine),
    draws:       Math.max(1, safeNum(raw.draws) ?? 1),
    lines,
    onceNumber:  safeStr(raw.onceNumber),
    onceSeries:  safeStr(raw.onceSeries),
    _rawText:    rawText,
    _confidence: safeNum(raw._confidence ?? raw._ocr?.confidence),
  };
}

// ─── ENTRADA PRINCIPAL ────────────────────────────────────────────

/**
 * Convierte la respuesta raw del servidor en un ScannedTicket tipado.
 * Pipeline:
 *   1. Reclasificación local (corrige errores del servidor)
 *   2. Parseo según tipo efectivo
 *   3. Si es lotería y no tiene líneas → fallback al extractor local
 *   4. Si el tipo es desconocido → clasificar localmente
 */
export function parseOcrResponse(raw: OcrServerResponse | any): ScannedTicket | null {
  if (!raw || typeof raw !== 'object') return null;

  const serverType = String(raw.type ?? '');
  const rawText    = safeStr(raw._rawText);

  // ── Reclasificación ──────────────────────────────────────────────
  const reclass       = reclassifyIfNeeded(serverType, rawText);
  const effectiveType = reclass.override ? reclass.type : serverType;

  // ── Parseo según tipo efectivo ────────────────────────────────────
  if (effectiveType === 'lottery') {
    const base = reclass.override && reclass.game
      ? { ...raw, game: raw.game ?? reclass.game }
      : raw;
    const ticket = parseLottery({ ...base, type: 'lottery' });

    // Si tras parseo las líneas están vacías, mezclar con extractor local
    if (!ticket.lines.length && rawText) {
      const local = extractLotteryFromText(rawText);
      if (local) return mergeLotteryTicket(ticket, local);
    }
    return ticket;
  }

  if (effectiveType === 'sports_bet') {
    return parseSportsBet(raw);
  }

  // ── Fallback: el servidor no devolvió tipo válido ─────────────────
  if (rawText) {
    const local = classifyTicket(rawText);

    if (local.type === 'lottery') {
      const serverPartial = parseLottery({ ...raw, type: 'lottery', game: raw.game ?? local.game });
      if (!serverPartial.lines.length) {
        const extracted = extractLotteryFromText(rawText);
        if (extracted) return mergeLotteryTicket(serverPartial, extracted);
      }
      return serverPartial;
    }

    if (local.type === 'sports_bet') {
      return parseSportsBet({ ...raw, type: 'sports_bet' });
    }
  }

  // ── Heurística por campos presentes ──────────────────────────────
  if (raw.operator || raw.stake != null || (raw.events?.length)) {
    return parseSportsBet({ ...raw, type: 'sports_bet' });
  }
  if (raw.game || raw.numbers || raw.lines) {
    return parseLottery({ ...raw, type: 'lottery' });
  }

  // ── Último recurso: intentar extractor local sobre texto crudo ───
  if (rawText) {
    const extracted = extractLotteryFromText(rawText);
    if (extracted) return mergeLotteryTicket({}, extracted) as LotteryTicket;
  }

  return null;
}

// ─── CONVERSIÓN A FORMATO BETSCONTEXT ─────────────────────────────

export function sportsBetToRaw(ticket: SportsBetTicket): Record<string, any> {
  return {
    type:      'sports_bet',
    operator:  ticket.operator,
    ticketId:  ticket.ticketId,
    betType:   ticket.betType,
    stake:     ticket.stake,
    maxWin:    ticket.maxWin,
    finalOdds: ticket.finalOdds,
    issuedAt:  ticket.issuedAt,
    scannedAt: ticket.scannedAt,
    events: ticket.events.map(e => ({
      sport:     e.sport,
      competition: e.competition,
      home:      e.home,
      away:      e.away,
      league:    e.league,
      market:    e.market,
      pick:      e.pick,
      odds:      e.odds,
      startTime: e.startTime,
      ...(e.group != null ? { group: e.group } : {}),
      outcome:   'pending',
    })),
  };
}
