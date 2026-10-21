// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Cálculos del panel de analítica: comparativa con el periodo anterior, series
// temporales por día/semana/mes, mapa de calor por día y rachas. Todo parte del
// resultado de buildBetStatistics, así cada cifra respeta los mismos filtros.
import type { SportsTicket } from './sportsTickets';
import { buildBetStatistics, financial, periodRange, ticketDate, type Period, type StatisticsFilters } from './betStatistics';
import { ticketReturn } from './cashout';

export type Stats = ReturnType<typeof buildBetStatistics>;
export type Range = { start: Date; end: Date };
export type Granularity = 'day' | 'week' | 'month';

const DAY = 864e5;
const pad = (n: number) => String(n).padStart(2, '0');
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const validStake = (t: SportsTicket) => Number.isFinite(t.stake) && t.stake > 0 ? t.stake : 0;
const rateOf = (won: number, lost: number) => won + lost ? won / (won + lost) * 100 : null;

/** Mismo tramo inmediatamente anterior (mes/año: hasta el mismo día). null en «Todo». */
export function previousPeriodFilters(period: Period, now: Date, filters: StatisticsFilters): StatisticsFilters | null {
  const range = periodRange(period, now, filters);
  if (!range || !Number.isFinite(range.start.getTime()) || !Number.isFinite(range.end.getTime())) return null;
  let from: Date, to: Date;
  if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    to = new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), new Date(now.getFullYear(), now.getMonth(), 0).getDate()));
  } else if (period === 'year') {
    from = new Date(now.getFullYear() - 1, 0, 1);
    to = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  } else {
    const days = Math.round((startOfDay(range.end).getTime() - startOfDay(range.start).getTime()) / DAY) + 1;
    to = addDays(startOfDay(range.start), -1);
    from = addDays(to, -(days - 1));
  }
  return { ...filters, from: isoDay(from), to: isoDay(to) };
}

export function buildComparison(all: SportsTicket[], period: Period, now: Date, filters: StatisticsFilters): Stats | null {
  const prev = previousPeriodFilters(period, now, filters);
  return prev ? buildBetStatistics(all, 'custom', now, prev) : null;
}

/** Rango efectivo: el del periodo o, en «Todo», del primer al último boleto fechado. */
export function effectiveRange(stats: Stats, period: Period, now: Date, filters: StatisticsFilters): Range | null {
  const range = periodRange(period, now, filters);
  if (range) return Number.isFinite(range.start.getTime()) ? range : null;
  const dates = stats.tickets.map(ticketDate).filter((d): d is Date => d != null).map(d => d.getTime());
  return dates.length ? { start: new Date(Math.min(...dates)), end: new Date(Math.max(...dates)) } : null;
}

export function autoGranularity(range: Range | null): Granularity {
  if (!range) return 'month';
  const days = (range.end.getTime() - range.start.getTime()) / DAY;
  return days <= 31 ? 'day' : days <= 190 ? 'week' : 'month';
}

function bucketStart(d: Date, g: Granularity) {
  if (g === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  if (g === 'week') return addDays(startOfDay(d), -((d.getDay() + 6) % 7)); // lunes
  return startOfDay(d);
}
const nextBucket = (d: Date, g: Granularity) => g === 'month' ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : addDays(d, g === 'week' ? 7 : 1);

export function bucketLabel(d: Date, g: Granularity) {
  if (g === 'month') return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
  const day = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return g === 'week' ? `Sem. ${day}` : day;
}

export type SeriesPoint = {
  key: string; start: Date; label: string; tickets: number; selections: number;
  won: number; lost: number; pending: number; rate: number | null;
  stake: number; balance: number | null; accumulated: number | null; roi: number | null;
};

const MAX_BUCKETS = 120;
/** Serie continua (incluye huecos vacíos) para el rango; engrosa la granularidad si hay demasiados puntos. */
export function buildSeries(stats: Stats, range: Range | null, wanted: Granularity): { granularity: Granularity; points: SeriesPoint[] } {
  if (!range) return { granularity: wanted, points: [] };
  const order: Granularity[] = ['day', 'week', 'month'];
  let g = wanted;
  const count = (gr: Granularity) => { let n = 0; for (let d = bucketStart(range.start, gr); d <= range.end && n <= MAX_BUCKETS; d = nextBucket(d, gr)) n++; return n; };
  while (g !== 'month' && count(g) > MAX_BUCKETS) g = order[order.indexOf(g) + 1];

  const byBucket = new Map<string, SportsTicket[]>();
  for (const t of stats.tickets) {
    const date = ticketDate(t);
    if (!date) continue;
    const key = isoDay(bucketStart(date, g));
    byBucket.set(key, [...(byBucket.get(key) ?? []), t]);
  }
  const legsByTicket = new Map<string, Stats['selections']>();
  for (const s of stats.selections) legsByTicket.set(s.ticketId, [...(legsByTicket.get(s.ticketId) ?? []), s]);

  const points: SeriesPoint[] = [];
  let accumulated = 0, any = false;
  for (let d = bucketStart(range.start, g); d <= range.end && points.length < MAX_BUCKETS; d = nextBucket(d, g)) {
    const key = isoDay(d);
    const tickets = byBucket.get(key) ?? [];
    const legs = tickets.flatMap(t => legsByTicket.get(t.id) ?? []);
    const won = legs.filter(s => s.outcome === 'won').length;
    const lost = legs.filter(s => s.outcome === 'lost').length;
    const money = financial(tickets);
    if (money.balance != null) { accumulated += money.balance; any = true; }
    points.push({ key, start: d, label: bucketLabel(d, g), tickets: tickets.length, selections: legs.length,
      won, lost, pending: legs.length - won - lost, rate: rateOf(won, lost),
      stake: tickets.reduce((sum, t) => sum + validStake(t), 0), balance: money.balance, roi: money.roi,
      accumulated: any ? accumulated : null });
  }
  return { granularity: g, points };
}

export type HeatCell = { key: string; date: Date; inRange: boolean; tickets: number; won: number; lost: number; stake: number; balance: number | null };
export type WeekdayStat = { label: string; tickets: number; won: number; lost: number; rate: number | null; balance: number | null };
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** Calendario (lunes→domingo) de las últimas 26 semanas del rango + resumen por día de la semana. */
export function buildHeatmap(stats: Stats, range: Range | null, maxWeeks = 26): { weeks: HeatCell[][]; weekdays: WeekdayStat[] } {
  const byDay = new Map<string, SportsTicket[]>();
  const byWeekday: SportsTicket[][] = WEEKDAYS.map(() => []);
  for (const t of stats.tickets) {
    const date = ticketDate(t);
    if (!date) continue;
    byDay.set(isoDay(date), [...(byDay.get(isoDay(date)) ?? []), t]);
    byWeekday[(date.getDay() + 6) % 7].push(t);
  }
  const weekdays = byWeekday.map((items, i) => {
    const won = items.filter(t => t.status === 'ganada').length, lost = items.filter(t => t.status === 'perdida').length;
    return { label: WEEKDAYS[i], tickets: items.length, won, lost, rate: rateOf(won, lost), balance: financial(items).balance };
  });
  if (!range) return { weeks: [], weekdays };
  const end = startOfDay(range.end);
  const first = bucketStart(new Date(Math.max(startOfDay(range.start).getTime(), addDays(end, -(maxWeeks * 7 - 1)).getTime())), 'week');
  const weeks: HeatCell[][] = [];
  for (let d = first; d <= end; d = addDays(d, 7)) {
    weeks.push(WEEKDAYS.map((_, i) => {
      const date = addDays(d, i);
      const items = byDay.get(isoDay(date)) ?? [];
      return { key: isoDay(date), date, inRange: date >= startOfDay(range.start) && date <= end, tickets: items.length,
        won: items.filter(t => t.status === 'ganada').length, lost: items.filter(t => t.status === 'perdida').length,
        stake: items.reduce((sum, t) => sum + validStake(t), 0), balance: financial(items).balance };
    }));
  }
  return { weeks, weekdays };
}
export const WEEKDAY_LABELS = WEEKDAYS;

/** Rachas de boletos resueltos por orden cronológico. Un cash out cuenta como ganado si no se perdió dinero. */
export function buildStreaks(stats: Stats) {
  const settled = stats.tickets.filter(t => t.status !== 'abierta' && t.status !== 'anulada' && ticketDate(t))
    .sort((a, b) => ticketDate(a)!.getTime() - ticketDate(b)!.getTime());
  let bestWin = 0, worstLoss = 0, run = 0, last: SportsTicket['status'] | null = null;
  for (const t of settled) {
    const result = t.status === 'cobrada' ? ((t.cashout ?? 0) >= validStake(t) ? 'ganada' : 'perdida') : t.status;
    run = result === last ? run + 1 : 1;
    last = result;
    if (result === 'ganada') bestWin = Math.max(bestWin, run); else worstLoss = Math.max(worstLoss, run);
  }
  return { current: last ? { status: last, length: run } : null, bestWin, worstLoss };
}

export type KpiKey = 'balance' | 'roi' | 'rate' | 'ticketRate' | 'stake' | 'tickets' | 'avgOdds' | 'avgStake' | 'avgProfit' | 'exposure' | 'potential' | 'biggestWin';
export type Snapshot = Record<KpiKey, number | null>;

export function snapshot(stats: Stats): Snapshot {
  const resolvedTickets = stats.wonTickets + stats.lostTickets;
  const staked = stats.tickets.filter(t => validStake(t) > 0);
  const open = stats.tickets.filter(t => t.status === 'abierta');
  const wins = stats.tickets.filter(t => (t.status === 'ganada' && t.maxWin > 0) || t.status === 'cobrada')
    .map(t => ticketReturn(t) - validStake(t)).filter(p => p > 0);
  return {
    balance: stats.balance, roi: stats.roi, rate: stats.rate,
    ticketRate: resolvedTickets ? stats.wonTickets / resolvedTickets * 100 : null,
    stake: stats.totalStake, tickets: stats.tickets.length, avgOdds: stats.avgSelectionOdds,
    avgStake: staked.length ? stats.totalStake / staked.length : null,
    avgProfit: stats.balance != null && stats.settledCount ? stats.balance / stats.settledCount : null,
    exposure: open.reduce((sum, t) => sum + validStake(t), 0),
    potential: open.reduce((sum, t) => sum + (t.maxWin > 0 ? t.maxWin : 0), 0),
    biggestWin: wins.length ? Math.max(...wins) : null,
  };
}

/** Variación frente al periodo anterior: puntos porcentuales para tasas, % relativo para el resto. */
export function kpiDelta(key: KpiKey, current: number | null, previous: number | null): { value: number; unit: 'pp' | '%' | '€' } | null {
  if (current == null || previous == null) return null;
  if (key === 'rate' || key === 'ticketRate' || key === 'roi') return { value: current - previous, unit: 'pp' };
  if (key === 'balance' || key === 'avgProfit') return { value: current - previous, unit: '€' };
  if (previous === 0) return null;
  return { value: (current - previous) / Math.abs(previous) * 100, unit: '%' };
}
