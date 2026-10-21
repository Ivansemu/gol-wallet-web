// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
const dec = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 57.35 -> "57,35 €" */
export const formatEuro = (n: number) => eur.format(n);
/** 52.35 -> "+52,35 €" */
export const formatProfit = (n: number) => `${n >= 0 ? '+' : '−'}${eur.format(Math.abs(n))}`;
/** 11.47 -> "11,47" */
export const formatOdds = (n: number) => dec.format(n);
/** Cuenta atrás compacta: "3d 04h" + "12m" */
export function countdown(to: Date, now = new Date()) {
  const ms = Math.max(0, to.getTime() - now.getTime());
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 36e5);
  const m = Math.floor((ms % 36e5) / 6e4);
  const pad = (x: number) => String(x).padStart(2, '0');
  return { main: d > 0 ? `${d}d ${pad(h)}h` : `${pad(h)}h`, rest: `${pad(m)}m` };
}
