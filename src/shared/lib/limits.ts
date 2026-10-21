// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Presupuesto mensual y pausa: cuánto llevas jugado este mes y si la app está en pausa.
// Funciones puras (sin React Native) para poder testearlas.

export type Limits = {
  /** Presupuesto del mes en euros (null = sin presupuesto). */
  monthly: number | null;
  /** Hasta cuándo no se pueden añadir boletos (ISO). null = sin pausa. */
  pausedUntil: string | null;
  /** Último aviso enviado, para no repetirlo: «2026-10:80». */
  alerted?: string | null;
};
export const DEFAULT_LIMITS: Limits = { monthly: null, pausedUntil: null, alerted: null };

export const PAUSES = [
  { label: '24 horas', days: 1 },
  { label: '7 días', days: 7 },
  { label: '30 días', days: 30 },
  { label: '90 días', days: 90 },
] as const;

export const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const toDate = (v: unknown): Date | null => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const d = v.length === 10 ? new Date(+v.slice(0, 4), +v.slice(5, 7) - 1, +v.slice(8, 10)) : new Date(v.replace(' ', 'T'));
  return Number.isFinite(d.getTime()) ? d : null;
};

/** Importe y fecha de cualquier boleto guardado (deportes o lotería). */
export function spendOf(b: Record<string, any>): { stake: number; date: Date | null } {
  const stake = Number(b.stake ?? b.stakeEUR ?? b.header?.stakeEUR ?? 0) || 0;
  const date = toDate(b.issuedAt) ?? toDate(b.header?.placedAtISO) ?? toDate(b.scannedAt);
  return { stake, date };
}

/** Total jugado en el mes de `now` (todos los boletos, deportes y lotería). */
export function monthSpend(bets: Record<string, any>[], now = new Date()): number {
  const key = monthKey(now);
  return Math.round(bets.reduce((sum, b) => {
    const { stake, date } = spendOf(b);
    return date && monthKey(date) === key ? sum + stake : sum;
  }, 0) * 100) / 100;
}

/** 0 = bien · 80 = cerca del límite · 100 = superado. */
export function budgetLevel(spent: number, monthly: number | null): 0 | 80 | 100 {
  if (!monthly || monthly <= 0) return 0;
  if (spent >= monthly) return 100;
  return spent >= monthly * 0.8 ? 80 : 0;
}

/** ¿Hay que avisar? Solo al cruzar un nivel nuevo en el mes (no se repite). */
export function budgetAlert(limits: Limits, spent: number, now = new Date()): { level: 80 | 100; mark: string } | null {
  const level = budgetLevel(spent, limits.monthly);
  if (!level) return null;
  const mark = `${monthKey(now)}:${level}`;
  if (limits.alerted === mark || (level === 80 && limits.alerted === `${monthKey(now)}:100`)) return null;
  return { level, mark };
}

export function isPaused(limits: Limits, now = new Date()): boolean {
  return !!limits.pausedUntil && new Date(limits.pausedUntil).getTime() > now.getTime();
}

export function pauseEnd(days: number, now = new Date()): string {
  return new Date(now.getTime() + days * 86_400_000).toISOString();
}
