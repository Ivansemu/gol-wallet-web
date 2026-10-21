// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Cash out: el usuario cerró la apuesta antes de tiempo en su casa y apunta lo que cobró.
// Ese importe sustituye al resultado (ganada → premio, perdida → 0) en todas las cuentas.
// Mismo tope que el servidor (winzo_slip_max_win en 0010_cashout.sql). Sin React Native: testeable en Node.

import type { SportsTicket } from './sportsTickets';

export type Cashout = { amount: number; at: string };

const positive = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ganancia máxima del boleto: la leída del boleto o, si no hay, importe × cuota. null = desconocida. */
export function cashoutCap(t: Record<string, any>): number | null {
  const read = positive(t.maxWin) ?? positive(t.potentialWinEUR) ?? positive(t.header?.potentialWinEUR);
  if (read) return round2(read);
  const stake = positive(t.stake ?? t.stakeEUR ?? t.header?.stakeEUR);
  const odds = positive(t.finalOdds ?? t.header?.finalOdds);
  return stake && odds ? round2(stake * odds) : null;
}

/** «12,50», «12.5», «1.234,56 €» → número; null si no es un importe. */
export function parseAmount(input: string): number | null {
  let s = input.replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}

/** Mensaje de error para el formulario; null si el importe vale. */
export function cashoutError(amount: number | null, cap: number | null): string | null {
  if (amount == null) return 'Escribe un importe válido, con dos decimales como mucho.';
  if (amount <= 0) return 'El importe debe ser mayor que 0 €.';
  if (cap != null && amount > cap) return 'No puede superar la ganancia máxima del boleto.';
  return null;
}

/** Cash out guardado en el boleto local, si es válido. */
export function cashoutOf(t: Record<string, any> | undefined): Cashout | null {
  const c = t?.cashout;
  const amount = positive(c?.amount);
  return amount ? { amount, at: typeof c.at === 'string' ? c.at : '' } : null;
}

/** Dinero recibido por un boleto cerrado: premio si ganó, lo cobrado si hubo cash out, 0 si perdió. */
export function ticketReturn(t: Pick<SportsTicket, 'status' | 'maxWin' | 'cashout'> & { payout?: number | null; stake?: number }): number {
  if (t.status === 'cobrada') return t.cashout ?? 0;
  // Nula: la casa devuelve el importe
  if (t.status === 'anulada') return t.payout ?? t.stake ?? 0;
  // Cobro calculado por el servidor (p. ej. medio perdida devuelve la mitad del importe)
  if (t.payout != null && (t.status === 'ganada' || t.status === 'perdida')) return t.payout;
  return t.status === 'ganada' ? t.maxWin : 0;
}
