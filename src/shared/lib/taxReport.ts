// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Informe anual para la declaración de la Renta (IRPF): ganancias y pérdidas del juego del año.
// Funciones puras (sin React Native) para poder testearlas. Es ORIENTATIVO: no es asesoramiento fiscal.
//
// Criterio (Ley 35/2006 del IRPF):
// · Apuestas deportivas: cada boleto da una ganancia (lo cobrado − lo apostado) o una pérdida.
//   Las pérdidas del juego solo se restan hasta el importe de las ganancias del juego del mismo año
//   (art. 33.5.d): el neto declarable nunca es negativo.
// · Premios de SELAE (Primitiva, Bonoloto, Euromillones, Lotería Nacional, Quiniela…): no se suman
//   a la base; tributan con el gravamen especial del 20 % en lo que pase de 40.000 € por décimo o
//   apuesta, retenido al cobrarlo. Lo jugado en lotería no se puede restar.

const round2 = (n: number) => Math.round(n * 100) / 100;

type SportsLike = {
  id: string; status: string; stake: number; maxWin: number; cashout?: number; operator: string;
  placedAt?: string; events: unknown[]; _raw: Record<string, any>;
};
type LotteryLike = Record<string, any>;

export type TaxRow = { date: string; concept: string; operator: string; stake: number; returned: number; result: number };
export type TaxReport = {
  year: number;
  sports: { gains: number; losses: number; computableLosses: number; net: number; open: number; rows: TaxRow[] };
  lottery: { prizes: number; spent: number; taxedPrizes: { concept: string; prize: number; taxable: number; withholding: number }[]; rows: TaxRow[] };
};

export const LOTTERY_EXEMPT = 40_000;
export const LOTTERY_RATE = 0.2;

const yearOf = (v?: string | null) => (v && /^\d{4}/.test(v) ? Number(v.slice(0, 4)) : null);

/** Lo que realmente devolvió el boleto: cash out, lo cobrado apuntado o el premio. */
export function sportsReturn(t: SportsLike): number {
  if (t.status === 'cobrada') return t.cashout ?? 0;
  if (t.status === 'anulada') return t.stake;
  if (t.status === 'ganada') {
    const paid = t._raw?.collected?.amount;
    return typeof paid === 'number' ? paid : t.maxWin;
  }
  return 0;
}

export function taxReport(sports: SportsLike[], lottery: LotteryLike[], year: number, gameName: (g?: string) => string = g => g ?? 'Lotería'): TaxReport {
  const rows: TaxRow[] = [];
  let gains = 0, losses = 0, open = 0;
  for (const t of sports) {
    if (yearOf(t.placedAt) !== year) continue;
    if (t.status === 'abierta') { open++; continue; }
    const returned = sportsReturn(t);
    const result = round2(returned - t.stake);
    if (result > 0) gains += result; else losses -= result;
    rows.push({ date: (t.placedAt ?? '').slice(0, 10), concept: t.events.length > 1 ? `Combinada de ${t.events.length}` : 'Apuesta sencilla',
      operator: t.operator, stake: t.stake, returned, result });
  }
  gains = round2(gains); losses = round2(losses);
  const computableLosses = Math.min(losses, gains);

  const lotRows: TaxRow[] = [];
  const taxedPrizes: TaxReport['lottery']['taxedPrizes'] = [];
  let prizes = 0, spent = 0;
  for (const b of lottery) {
    const date = b.drawDate ?? b.checkResult?.drawDate ?? b.scannedAt;
    if (yearOf(date) !== year) continue;
    const stake = Number(b.stake ?? 0) || 0;
    const prize = Number(b.checkResult?.totalPrize ?? 0) || 0;
    spent += stake; prizes += prize;
    lotRows.push({ date: String(date).slice(0, 10), concept: gameName(b.game), operator: 'SELAE', stake, returned: prize, result: round2(prize - stake) });
    // Gravamen especial: por premio (aproximación: el boleto entero como un solo premio)
    if (prize > LOTTERY_EXEMPT) {
      const taxable = round2(prize - LOTTERY_EXEMPT);
      taxedPrizes.push({ concept: `${gameName(b.game)} ${String(date).slice(0, 10)}`, prize, taxable, withholding: round2(taxable * LOTTERY_RATE) });
    }
  }
  return {
    year,
    sports: { gains, losses, computableLosses, net: round2(gains - computableLosses), open, rows: rows.sort((a, b) => a.date.localeCompare(b.date)) },
    lottery: { prizes: round2(prizes), spent: round2(spent), taxedPrizes, rows: lotRows.sort((a, b) => a.date.localeCompare(b.date)) },
  };
}

/** Años con algún boleto, del más reciente al más antiguo. */
export function reportYears(sports: SportsLike[], lottery: LotteryLike[], now = new Date()): number[] {
  const ys = new Set<number>([now.getFullYear()]);
  for (const t of sports) { const y = yearOf(t.placedAt); if (y) ys.add(y); }
  for (const b of lottery) { const y = yearOf(b.drawDate ?? b.scannedAt); if (y) ys.add(y); }
  return [...ys].sort((a, b) => b - a);
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

export function taxReportHtml(r: TaxReport, owner: string, generatedAt = new Date()): string {
  const table = (list: TaxRow[]) => list.length
    ? `<table><tr><th>Fecha</th><th>Concepto</th><th>Operador</th><th>Apostado</th><th>Cobrado</th><th>Resultado</th></tr>${list.map(x =>
      `<tr><td>${esc(x.date)}</td><td>${esc(x.concept)}</td><td>${esc(x.operator)}</td><td>${eur(x.stake)}</td><td>${eur(x.returned)}</td><td class="${x.result >= 0 ? 'pos' : 'neg'}">${eur(x.result)}</td></tr>`).join('')}</table>`
    : '<p class="muted">Sin boletos en este año.</p>';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Gol-Wallet · Renta ${r.year}</title><style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0B1A12;margin:32px;font-size:12px}
  h1{font-size:22px;margin:0 0 4px} h2{font-size:15px;margin:26px 0 8px;border-bottom:1px solid #DCE5DD;padding-bottom:6px}
  .muted{color:#4A5B50} .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
  .kpi{border:1px solid #DCE5DD;border-radius:10px;padding:10px} .kpi .l{color:#4A5B50;font-size:10px;text-transform:uppercase}
  .kpi .v{font-size:17px;font-weight:700;margin-top:4px} .box{background:#F4F7F2;border-radius:10px;padding:12px;margin-top:10px}
  table{width:100%;border-collapse:collapse;margin-top:6px} th,td{text-align:left;padding:5px 7px;border-bottom:1px solid #DCE5DD} th{background:#EEF3EF}
  .pos{color:#1D7A3E} .neg{color:#B3261E} tr{break-inside:avoid}</style></head><body>
  <h1>Informe del juego · ejercicio ${r.year}</h1>
  <div class="muted">${esc(owner)} · Generado con Gol-Wallet el ${generatedAt.toLocaleDateString('es-ES')}</div>

  <h2>Apuestas deportivas</h2>
  <div class="grid">
    <div class="kpi"><div class="l">Ganancias</div><div class="v pos">${eur(r.sports.gains)}</div></div>
    <div class="kpi"><div class="l">Pérdidas</div><div class="v neg">${eur(r.sports.losses)}</div></div>
    <div class="kpi"><div class="l">Pérdidas computables</div><div class="v">${eur(r.sports.computableLosses)}</div></div>
    <div class="kpi"><div class="l">Ganancia neta</div><div class="v">${eur(r.sports.net)}</div></div>
  </div>
  <div class="box">En la Renta, las ganancias y pérdidas del juego van como <strong>ganancias y pérdidas patrimoniales que no derivan de la transmisión de elementos patrimoniales</strong> (base general).
  Las pérdidas solo se restan hasta el importe de las ganancias del mismo año, por eso el neto nunca es negativo.${r.sports.open ? ` Hay ${r.sports.open} boleto(s) de ${r.year} sin resolver que no se han contado.` : ''}</div>
  ${table(r.sports.rows)}

  <h2>Lotería (SELAE)</h2>
  <div class="grid">
    <div class="kpi"><div class="l">Jugado</div><div class="v">${eur(r.lottery.spent)}</div></div>
    <div class="kpi"><div class="l">Premios</div><div class="v">${eur(r.lottery.prizes)}</div></div>
    <div class="kpi"><div class="l">Premios de más de 40.000 €</div><div class="v">${r.lottery.taxedPrizes.length}</div></div>
    <div class="kpi"><div class="l">Retención estimada</div><div class="v">${eur(r.lottery.taxedPrizes.reduce((s, p) => s + p.withholding, 0))}</div></div>
  </div>
  <div class="box">Los premios de Loterías y Apuestas del Estado no se suman a la base del IRPF: los primeros 40.000 € de cada premio están exentos y el resto tributa al 20 %,
  que se retiene al cobrarlo. Lo jugado en lotería no se puede restar.</div>
  ${table(r.lottery.rows)}

  <p class="muted" style="margin-top:24px">Informe orientativo elaborado con los boletos que has registrado en Gol-Wallet. No es asesoramiento fiscal: revísalo con la Agencia Tributaria o con tu asesor antes de presentar la declaración.
  Conserva los boletos y los justificantes de cobro.</p>
  </body></html>`;
}
