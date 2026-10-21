// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
import type { SportsTicket, NormalizedEvent } from './sportsTickets';
import { ticketReturn } from './cashout';
import { isSystemBet } from './systemBets';

export type Period = 'today' | 'last7' | 'last30' | 'month' | 'year' | 'all' | 'custom';
export type Dimension = 'market' | 'league' | 'sport' | 'operator' | 'odds';
export type StatisticsFilters = Partial<Record<Dimension, string[]>> & {
  outcome?: SelectionStat['outcome'][];
  betType?: 'single' | 'multiple' | 'system';
  query?: string;
  from?: string;
  to?: string;
};
export type SelectionStat = {
  ticketId: string; event: NormalizedEvent; operator: string;
  /** void = nula: fuera del denominador de acierto y no es pendiente. */
  outcome: 'won' | 'lost' | 'pending' | 'void';
};
export type GroupStat = {
  key: string; label: string; won: number; lost: number; pending: number;
  total: number; resolved: number; rate: number | null; avgOdds: number | null;
  selections: SelectionStat[];
};
const keyOf = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
const text = (v?: string) => v?.trim().replace(/\s+/g, ' ');

export function sportLabel(s?: string): string {
  const aliases: Record<string, string> = {
    football: 'Fútbol', soccer: 'Fútbol', futbol: 'Fútbol',
    basketball: 'Baloncesto', baloncesto: 'Baloncesto', basket: 'Baloncesto',
    tennis: 'Tenis', tenis: 'Tenis', hockey: 'Hockey', baseball: 'Béisbol', beisbol: 'Béisbol',
    volleyball: 'Voleibol', voleibol: 'Voleibol', 'american football': 'Fútbol americano',
    american_football: 'Fútbol americano', 'futbol americano': 'Fútbol americano',
    handball: 'Balonmano', balonmano: 'Balonmano', rugby: 'Rugby', 'ice hockey': 'Hockey',
  };
  return aliases[keyOf(s ?? '')] || text(s) || 'Sin indicar';
}

export function groupLabel(s: SelectionStat, dimension: Dimension): string {
  if (dimension === 'sport') return sportLabel(s.event.sport);
  if (dimension === 'league') return text(s.event.league) || text(s.event.competition) || 'Sin indicar';
  if (dimension === 'operator') return text(s.operator) || 'Sin indicar';
  if (dimension === 'odds') {
    const odds = s.event.odds;
    if (odds == null || !Number.isFinite(odds) || odds <= 1) return 'Sin indicar';
    return odds < 1.5 ? 'Menos de 1,50' : odds < 2 ? '1,50 a 1,99' : odds < 3 ? '2,00 a 2,99' : '3,00 o más';
  }
  const market = text(s.event.market);
  const aliases: Record<string, string> = {
    '1x2': 'Resultado final (1X2)', 'resultado final': 'Resultado final (1X2)',
    'match result': 'Resultado final (1X2)', 'full time result': 'Resultado final (1X2)',
    'double chance': 'Doble oportunidad', 'doble oportunidad': 'Doble oportunidad',
    'both teams to score': 'Ambos marcan', 'ambos marcan': 'Ambos marcan', btts: 'Ambos marcan',
  };
  // No se fusionan líneas, periodos ni hándicaps distintos.
  return aliases[keyOf(market ?? '')] || market || 'Sin indicar';
}

export function groupSelections(selections: SelectionStat[], dimension: Dimension): GroupStat[] {
  const groups = new Map<string, SelectionStat[]>();
  for (const selection of selections) {
    const label = groupLabel(selection, dimension);
    const key = keyOf(label);
    groups.set(key, [...(groups.get(key) ?? []), selection]);
  }
  return [...groups].map(([key, items]) => {
    const won = items.filter(s => s.outcome === 'won').length;
    const lost = items.filter(s => s.outcome === 'lost').length;
    const odds = items.map(s => s.event.odds).filter((o): o is number => o != null && Number.isFinite(o) && o > 1);
    return { key, label: groupLabel(items[0], dimension), won, lost, pending: items.filter(s => s.outcome === 'pending').length,
      resolved: won + lost, total: items.length, rate: won + lost ? won / (won + lost) * 100 : null,
      avgOdds: odds.length ? odds.reduce((a, b) => a + b, 0) / odds.length : null, selections: items };
  });
}

export function ticketDate(ticket: SportsTicket): Date | null {
  if (!ticket.placedAt || !/^\d{4}-\d{2}-\d{2}/.test(ticket.placedAt)) return null;
  const calendarDate = parseFilterDate(ticket.placedAt.slice(0, 10));
  if (!calendarDate) return null;
  const date = ticket.placedAt.length === 10 ? calendarDate : new Date(ticket.placedAt);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function parseFilterDate(value?: string): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function statisticsFilterError(period: Period, filters: StatisticsFilters): string | null {
  if (period !== 'custom') return null;
  const from = parseFilterDate(filters.from), to = parseFilterDate(filters.to);
  if (!from || !to) return 'Introduce dos fechas válidas con formato AAAA-MM-DD.';
  return from > to ? 'La fecha inicial debe ser anterior o igual a la final.' : null;
}

const dimensions: Dimension[] = ['sport', 'league', 'market', 'operator', 'odds'];
export function hasSelectionFilters(filters: StatisticsFilters): boolean {
  return dimensions.some(d => !!filters[d]?.length) || !!filters.outcome?.length || !!filters.query?.trim();
}

function matchesSelection(selection: SelectionStat, filters: StatisticsFilters): boolean {
  if (!dimensions.every(d => !filters[d]?.length || filters[d]!.includes(keyOf(groupLabel(selection, d))))) return false;
  if (filters.outcome?.length && !filters.outcome.includes(selection.outcome)) return false;
  const query = keyOf(filters.query ?? '');
  const event = selection.event;
  return !query || keyOf([event.home, event.away, event.pick, event.selection, event.market, event.league, event.competition, sportLabel(event.sport), selection.operator].filter(Boolean).join(' ')).includes(query);
}

function matchesTicket(ticket: SportsTicket, filters: StatisticsFilters): boolean {
  if (!filters.betType) return true;
  const system = isSystemBet(ticket._raw?.betType);
  const kind = system ? 'system' : ticket.events.length === 1 ? 'single' : 'multiple';
  return kind === filters.betType;
}
const validAmount = (n: number) => Number.isFinite(n) && n > 0;
export function financial(tickets: SportsTicket[]) {
  const settled = tickets.filter(t => t.status !== 'abierta');
  const usable = settled.filter(t => validAmount(t.stake) && (t.status !== 'ganada' || validAmount(t.maxWin)));
  const stake = usable.reduce((sum, t) => sum + t.stake, 0);
  const returns = usable.reduce((sum, t) => sum + ticketReturn(t), 0);
  return { stake, returns, balance: usable.length ? returns - stake : null, settledCount: usable.length,
    roi: stake ? (returns - stake) / stake * 100 : null, excluded: settled.length - usable.length };
}

/** Rango del periodo; null = todo el historial, sin límites de fecha. */
export function periodRange(period: Period, now = new Date(), filters: StatisticsFilters = {}): { start: Date; end: Date } | null {
  if (period === 'all') return null;
  if (period === 'custom') {
    const start = parseFilterDate(filters.from) ?? new Date(NaN);
    const end = parseFilterDate(filters.to) ?? new Date(NaN);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  const day = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const start = period === 'today' ? day(0) : period === 'last7' ? day(-6) : period === 'last30' ? day(-29)
    : period === 'month' ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), 0, 1);
  return { start, end: now };
}

export function buildBetStatistics(all: SportsTicket[], period: Period, now = new Date(), filters: StatisticsFilters = {}) {
  const range = periodRange(period, now, filters);
  const dateError = statisticsFilterError(period, filters);
  const periodTickets = all.filter(t => {
    if (dateError || !matchesTicket(t, filters)) return false;
    if (!range) return true;
    const date = ticketDate(t);
    return date != null && date >= range.start && date <= range.end;
  });
  const selections: SelectionStat[] = periodTickets.flatMap(t => t.events.map((event, i) => ({
    ticketId: t.id, operator: t.operator, event, outcome: t.legs[i] ?? 'pending',
  }))).filter(selection => matchesSelection(selection, filters));
  const matchingIds = new Set(selections.map(s => s.ticketId));
  const tickets = hasSelectionFilters(filters) ? periodTickets.filter(t => matchingIds.has(t.id)) : periodTickets;
  const won = selections.filter(s => s.outcome === 'won').length;
  const lost = selections.filter(s => s.outcome === 'lost').length;
  const months = new Map<string, SportsTicket[]>();
  for (const ticket of tickets) {
    const date = ticketDate(ticket);
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.set(key, [...(months.get(key) ?? []), ticket]);
  }
  const monthly = [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, items]) => {
    const ids = new Set(items.map(t => t.id));
    const legs = selections.filter(s => ids.has(s.ticketId));
    const won = legs.filter(s => s.outcome === 'won').length;
    const lost = legs.filter(s => s.outcome === 'lost').length;
    return { month, count: items.length, won, lost, pending: legs.filter(s => s.outcome === 'pending').length,
      rate: won + lost ? won / (won + lost) * 100 : null, ...financial(items) };
  });
  let accumulated = 0;
  const timeline = monthly.map(month => {
    if (month.balance != null) accumulated += month.balance;
    return { ...month, accumulated: month.balance == null ? null : accumulated };
  });
  const knownOdds = selections.map(s => s.event.odds).filter((n): n is number => n != null && Number.isFinite(n) && n > 1);
  return {
    dateError, timeline, avgSelectionOdds: knownOdds.length ? knownOdds.reduce((sum, n) => sum + n, 0) / knownOdds.length : null,
    tickets, selections, won, lost, pending: selections.filter(s => s.outcome === 'pending').length,
    voidSelections: selections.filter(s => s.outcome === 'void').length,
    rate: won + lost ? won / (won + lost) * 100 : null,
    open: tickets.filter(t => t.status === 'abierta').length,
    wonTickets: tickets.filter(t => t.status === 'ganada').length,
    lostTickets: tickets.filter(t => t.status === 'perdida').length,
    cashoutTickets: tickets.filter(t => t.status === 'cobrada').length,
    totalStake: tickets.reduce((sum, t) => sum + (validAmount(t.stake) ? t.stake : 0), 0),
    undated: all.filter(t => !ticketDate(t)).length,
    ...financial(tickets),
    months: [...monthly].reverse(),
  };
}
