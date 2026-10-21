'use client';
import { useMemo, useState } from 'react';
import { calculateSystemBet, type SystemBetType } from '../../shared/lib/systemBets';
import { bookMargin, convertOdds, toDecimal } from '../../shared/lib/tools';
import { formatEuro, formatOdds } from '../../shared/utils/format';
import { Leader, Receipt, ReceiptHead } from '../../components/receipt';

const SYSTEMS: { type: SystemBetType; label: string; n: number }[] = [
  { type: 'trixie', label: 'Trixie', n: 3 }, { type: 'patent', label: 'Patent', n: 3 }, { type: 'yankee', label: 'Yankee', n: 4 },
  { type: 'lucky15', label: 'Lucky 15', n: 4 }, { type: 'canadian', label: 'Canadian', n: 5 }, { type: 'heinz', label: 'Heinz', n: 6 },
];
const dec = (s: string) => { const x = Number(s.replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
const pct = (p: number) => `${(p * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`;

function SystemCalc() {
  const [type, setType] = useState<SystemBetType>('trixie');
  const n = SYSTEMS.find(s => s.type === type)!.n;
  const [odds, setOdds] = useState<string[]>(['1,80', '2,10', '1,95', '2,40', '1,70', '2,00']);
  const [won, setWon] = useState<boolean[]>([true, true, false, true, true, true]);
  const [stake, setStake] = useState('1');
  const r = useMemo(() => {
    const sels = odds.slice(0, n).map((o, i) => ({ odds: dec(o), won: won[i] }));
    if (sels.some(s => !(s.odds > 1)) || !(dec(stake) > 0)) return null;
    return calculateSystemBet(sels, type, dec(stake));
  }, [odds, won, n, type, stake]);
  return (
    <section className="card stack" aria-labelledby="sistemas">
      <h2 id="sistemas" style={{ fontSize: 22 }}>Calculadora de sistemas</h2>
      <div className="seg" role="group" aria-label="Tipo de sistema">
        {SYSTEMS.map(s => <button key={s.type} aria-pressed={type === s.type} onClick={() => setType(s.type)}>{s.label}</button>)}
      </div>
      <div className="field" style={{ maxWidth: 200 }}><label htmlFor="sl">Importe por línea (€)</label>
        <input id="sl" className="input" inputMode="decimal" value={stake} onChange={e => setStake(e.target.value)} /></div>
      <div className="stack-sm">
        {Array.from({ length: n }, (_, i) => (
          <div key={i} className="row">
            <span className="mono" style={{ width: 24 }}>{i + 1}</span>
            <input className="input" style={{ maxWidth: 120 }} inputMode="decimal" aria-label={`Cuota ${i + 1}`} value={odds[i]} onChange={e => setOdds(p => p.map((x, j) => (j === i ? e.target.value : x)))} />
            <label className="row" style={{ gap: 6 }}><input type="checkbox" style={{ width: 20, height: 20 }} checked={won[i]} onChange={e => setWon(p => p.map((x, j) => (j === i ? e.target.checked : x)))} /> Acertada</label>
          </div>
        ))}
      </div>
      {r ? (
        <Receipt flat>
          <ReceiptHead left={SYSTEMS.find(s => s.type === type)!.label} right={`${r.linesTotal} líneas`} />
          <div style={{ marginTop: 10 }}>
            <Leader label="Coste total" value={formatEuro(r.totalStake)} />
            <Leader label="Si aciertas todo" value={formatEuro(r.maxWin)} />
            <Leader label={`Con lo marcado (${r.linesWon} líneas)`} value={formatEuro(r.currentReturn)} strong />
            <Leader label="Balance" value={formatEuro(r.currentReturn - r.totalStake)} />
          </div>
        </Receipt>
      ) : <p className="error">Revisa las cuotas (mayores que 1) y el importe.</p>}
    </section>
  );
}

function OddsConverter() {
  const [v, setV] = useState('2,50');
  const d = toDecimal(v);
  const c = d ? convertOdds(d) : null;
  return (
    <section className="card stack" aria-labelledby="conversor">
      <h2 id="conversor" style={{ fontSize: 22 }}>Conversor de cuotas</h2>
      <div className="field" style={{ maxWidth: 260 }}><label htmlFor="cv">Cuota (decimal, «5/2» o «+150»)</label>
        <input id="cv" className="input" value={v} onChange={e => setV(e.target.value)} /></div>
      {c && d ? (
        <Receipt flat>
          <Leader label="Decimal" value={formatOdds(d)} />
          <Leader label="Fraccionaria" value={c.fractional} />
          <Leader label="Americana" value={c.american} />
          <Leader label="Probabilidad implícita" value={pct(c.prob)} strong />
        </Receipt>
      ) : <p className="error">No reconozco esa cuota.</p>}
    </section>
  );
}

function Margin() {
  const [vals, setVals] = useState(['2,10', '3,40', '3,60']);
  const m = bookMargin(vals.map(dec));
  return (
    <section className="card stack" aria-labelledby="margen">
      <h2 id="margen" style={{ fontSize: 22 }}>Margen de la casa</h2>
      <p className="muted" style={{ fontSize: 14 }}>Escribe las cuotas de todos los resultados de un mercado (p. ej. 1, X y 2). La diferencia con el 100 % es lo que se queda la casa.</p>
      <div className="row">
        {vals.map((x, i) => <input key={i} className="input" style={{ maxWidth: 110 }} inputMode="decimal" aria-label={`Cuota ${i + 1}`} value={x} onChange={e => setVals(p => p.map((y, j) => (j === i ? e.target.value : y)))} />)}
        <button className="btn ghost sm" onClick={() => setVals(p => (p.length < 6 ? [...p, '2,00'] : p))}>+ resultado</button>
        {vals.length > 2 && <button className="btn ghost sm" onClick={() => setVals(p => p.slice(0, -1))}>− resultado</button>}
      </div>
      {m ? (
        <Receipt flat>
          <Leader label="Margen" value={`${m.margin.toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`} strong />
          {m.fairOdds.map((f, i) => <Leader key={i} label={`Cuota justa ${i + 1}`} value={`${formatOdds(f)} · ${pct(m.probs[i])}`} />)}
        </Receipt>
      ) : <p className="error">Necesito al menos dos cuotas mayores que 1.</p>}
    </section>
  );
}

export function Tools() {
  return <div className="grid-2" style={{ alignItems: 'start' }}><SystemCalc /><div className="stack"><OddsConverter /><Margin /></div></div>;
}
