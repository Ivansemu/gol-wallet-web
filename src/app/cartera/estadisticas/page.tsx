'use client';
import { useMemo, useState } from 'react';
import { useWallet } from '../../../lib/useWallet';
import { buildBetStatistics, groupSelections, type Dimension, type Period } from '../../../shared/lib/betStatistics';
import { formatEuro, formatOdds, formatProfit } from '../../../shared/utils/format';
import { Leader, Marker, Receipt, ReceiptHead } from '../../../components/receipt';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'last30', label: '30 días' }, { key: 'month', label: 'Este mes' }, { key: 'year', label: 'Este año' }, { key: 'all', label: 'Todo' },
];
const DIMS: { key: Dimension; label: string }[] = [
  { key: 'operator', label: 'Casa' }, { key: 'sport', label: 'Deporte' }, { key: 'league', label: 'Liga' }, { key: 'market', label: 'Mercado' }, { key: 'odds', label: 'Cuota' },
];
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n)} %`);
const monthName = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });

/** Mismas cuentas que la pantalla de Estadísticas de la app (src/shared/lib/betStatistics.ts). */
export default function Estadisticas() {
  const { tickets } = useWallet();
  const [period, setPeriod] = useState<Period>('all');
  const [dim, setDim] = useState<Dimension>('operator');
  const s = useMemo(() => (tickets ? buildBetStatistics(tickets, period) : null), [tickets, period]);
  const groups = useMemo(() => (s ? groupSelections(s.selections, dim).sort((a, b) => b.total - a.total).slice(0, 12) : []), [s, dim]);
  if (!s) return <p className="muted" role="status">Cargando…</p>;
  const maxAbs = Math.max(1, ...s.months.map(m => Math.abs(m.balance ?? 0)));

  return (
    <div className="stack" style={{ paddingTop: 12 }}>
      <div className="between">
        <h1 style={{ fontSize: 30 }}>Estadísticas</h1>
        <div className="seg" role="group" aria-label="Periodo">
          {PERIODS.map(p => <button key={p.key} aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}>{p.label}</button>)}
        </div>
      </div>
      {!s.tickets.length ? <p className="muted">Aún no hay boletos en este periodo.</p> : (
        <>
          <div className="grid-2" style={{ alignItems: 'start' }}>
            <Receipt>
              <ReceiptHead left="Balance real" right={PERIODS.find(p => p.key === period)?.label} />
              <div style={{ margin: '12px 0' }}><Marker>{s.balance == null ? '—' : formatProfit(s.balance)}</Marker></div>
              <Leader label="Boletos" value={String(s.tickets.length)} />
              <Leader label="Apostado" value={formatEuro(s.totalStake)} />
              <Leader label="Cobrado" value={formatEuro(s.returns)} />
              <Leader label="Acierto por selección" value={pct(s.rate)} />
              {s.avgSelectionOdds != null && <Leader label="Cuota media" value={formatOdds(s.avgSelectionOdds)} />}
            </Receipt>
            <div className="kpis">
              <div className="kpi"><span className="subtle">Abiertos</span><b>{s.open}</b></div>
              <div className="kpi"><span className="subtle">Ganados</span><b>{s.wonTickets}</b></div>
              <div className="kpi"><span className="subtle">Perdidos</span><b>{s.lostTickets}</b></div>
              <div className="kpi"><span className="subtle">Cash out</span><b>{s.cashoutTickets}</b></div>
            </div>
          </div>

          {s.months.length > 0 && (
            <section className="card stack" aria-labelledby="meses">
              <h2 id="meses" style={{ fontSize: 20 }}>Por mes</h2>
              <div className="bars">
                {s.months.slice(0, 12).map(m => (
                  <div className="bar-row" key={m.month}>
                    <span className="mono">{monthName(m.month)}</span>
                    <div className="bar-track" aria-hidden><div className={`bar-fill${(m.balance ?? 0) < 0 ? ' neg' : ''}`} style={{ width: `${Math.abs(m.balance ?? 0) / maxAbs * 100}%` }} /></div>
                    <span className="mono">{m.balance == null ? '—' : formatProfit(m.balance)}</span>
                  </div>
                ))}
              </div>
              <p className="subtle">Azul: meses en positivo. Naranja: en negativo. Solo cuentan los boletos ya resueltos.</p>
            </section>
          )}

          <section className="card stack" aria-labelledby="grupos">
            <div className="between">
              <h2 id="grupos" style={{ fontSize: 20 }}>Selecciones por…</h2>
              <div className="seg" role="group" aria-label="Agrupar por">
                {DIMS.map(d => <button key={d.key} aria-pressed={dim === d.key} onClick={() => setDim(d.key)}>{d.label}</button>)}
              </div>
            </div>
            <div className="table-scroll">
              <table className="t">
                <thead><tr><th>{DIMS.find(d => d.key === dim)?.label}</th><th>Total</th><th>Acertadas</th><th>Falladas</th><th>Acierto</th><th>Cuota media</th></tr></thead>
                <tbody>{groups.map(g => (
                  <tr key={g.key}><td>{g.label}</td><td className="num">{g.total}</td><td className="num">{g.won}</td><td className="num">{g.lost}</td>
                    <td className="num">{pct(g.rate)}</td><td className="num">{g.avgOdds == null ? '—' : formatOdds(g.avgOdds)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
