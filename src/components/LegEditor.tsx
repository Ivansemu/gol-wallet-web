'use client';
// Una selección del boleto: partido del backoffice (se resuelve sola) o escrita a mano (la revisa el equipo).
import { useMemo, useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import type { ManualLeg } from '../lib/wallet';
import { MARKET_DEFS, MARKET_ORDER, buildSelection, defaultChoice, searchFixtures, type FixtureOption, type MarketChoice, type MarketKind } from '../shared/lib/manualMarkets';

const PICKS: Partial<Record<MarketKind, { value: string; label: (h: string, a: string) => string }[]>> = {
  match_result: [{ value: 'home', label: h => h }, { value: 'draw', label: () => 'Empate' }, { value: 'away', label: (_, a) => a }],
  match_result_2gv: [{ value: 'home', label: h => h }, { value: 'draw', label: () => 'Empate' }, { value: 'away', label: (_, a) => a }],
  btts: [{ value: 'yes', label: () => 'Sí' }, { value: 'no', label: () => 'No' }],
  double_chance: [{ value: '1X', label: () => '1X' }, { value: 'X2', label: () => 'X2' }, { value: '12', label: () => '12' }],
};

export function LegEditor({ n, leg, fixtures, onChange, onRemove }: {
  n: number; leg: ManualLeg; fixtures: FixtureOption[] | null; onChange: (l: ManualLeg) => void; onRemove?: () => void;
}) {
  const [q, setQ] = useState('');
  const [choice, setChoice] = useState<MarketChoice>(defaultChoice('match_result'));
  const [odds, setOdds] = useState(leg.odds ? String(leg.odds).replace('.', ',') : '');
  const hits = useMemo(() => (fixtures && q.trim().length > 1 ? searchFixtures(fixtures, q).slice(0, 8) : []), [fixtures, q]);
  const linked = !!leg.fixtureId;

  const apply = (c: MarketChoice, base = leg) => {
    setChoice(c);
    const built = buildSelection(c, base.home, base.away);
    onChange({ ...base, market: built?.market ?? MARKET_DEFS[c.kind].label, pick: built?.pick ?? '', marketKey: built?.marketKey, marketParams: built?.params });
  };
  const setOddsText = (v: string) => { setOdds(v); const x = Number(v.replace(',', '.')); onChange({ ...leg, odds: Number.isFinite(x) && x > 0 ? x : null }); };
  const def = MARKET_DEFS[choice.kind];

  return (
    <fieldset className="card stack-sm" style={{ margin: 0 }}>
      <legend className="overline" style={{ padding: '0 6px' }}>Selección {n}</legend>
      {linked ? (
        <div className="between">
          <strong>{leg.home} - {leg.away}</strong>
          <button type="button" className="btn ghost sm" onClick={() => onChange({ home: '', away: '', market: '', pick: '', odds: leg.odds })}>Cambiar partido</button>
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor={`q${n}`}><Search size={14} aria-hidden /> Busca el partido</label>
            <input id={`q${n}`} className="input" placeholder="Ej.: betis sevilla" value={q} onChange={e => setQ(e.target.value)} disabled={!fixtures} />
            {!fixtures && <span className="hint">Cargando partidos…</span>}
          </div>
          {hits.length > 0 && (
            <ul className="stack-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {hits.map(f => (
                <li key={f.id}><button type="button" className="btn ghost sm block" style={{ justifyContent: 'space-between' }}
                  onClick={() => { setQ(''); apply(choice, { ...leg, home: f.home, away: f.away, fixtureId: f.id, startTime: f.startsAt }); }}>
                  <span>{f.home} - {f.away}</span>
                  <span className="subtle">{f.competition ?? ''} · {new Date(f.startsAt).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </button></li>
              ))}
            </ul>
          )}
          <p className="hint">¿No aparece? Escríbelo a mano y nuestro equipo lo emparejará.</p>
          <div className="grid-2" style={{ gap: 8 }}>
            <input className="input" aria-label={`Local, selección ${n}`} placeholder="Local" value={leg.home} onChange={e => onChange({ ...leg, home: e.target.value })} />
            <input className="input" aria-label={`Visitante, selección ${n}`} placeholder="Visitante" value={leg.away} onChange={e => onChange({ ...leg, away: e.target.value })} />
          </div>
        </>
      )}

      <div className="grid-2" style={{ gap: 8 }}>
        <div className="field">
          <label htmlFor={`m${n}`}>Mercado</label>
          <select id={`m${n}`} className="input" value={choice.kind} onChange={e => apply(defaultChoice(e.target.value as MarketKind))}>
            {MARKET_ORDER.map(k => <option key={k} value={k}>{MARKET_DEFS[k].label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={`o${n}`}>Cuota</label>
          <input id={`o${n}`} className="input" inputMode="decimal" placeholder="1,85" value={odds} onChange={e => setOddsText(e.target.value)} />
        </div>
      </div>

      {PICKS[choice.kind] ? (
        <div className="seg" role="group" aria-label="Pronóstico">
          {PICKS[choice.kind]!.map(p => (
            <button type="button" key={p.value} aria-pressed={choice.pick === p.value} onClick={() => apply({ ...choice, pick: p.value })}>
              {p.label(leg.home || 'Local', leg.away || 'Visitante')}
            </button>
          ))}
        </div>
      ) : def.lines ? (
        <div className="row">
          <div className="seg" role="group" aria-label="Más o menos">
            {(['over', 'under'] as const).map(s => <button type="button" key={s} aria-pressed={choice.side === s} onClick={() => apply({ ...choice, side: s })}>{s === 'over' ? 'Más de' : 'Menos de'}</button>)}
          </div>
          <select className="input" style={{ maxWidth: 120 }} aria-label="Línea" value={choice.line} onChange={e => apply({ ...choice, line: Number(e.target.value) })}>
            {def.lines.map(l => <option key={l} value={l}>{String(l).replace('.', ',')}</option>)}
          </select>
          <select className="input" style={{ maxWidth: 200 }} aria-label="Equipo" value={choice.team} onChange={e => apply({ ...choice, team: e.target.value as MarketChoice['team'] })}>
            <option value="all">Partido</option><option value="home">{leg.home || 'Local'}</option><option value="away">{leg.away || 'Visitante'}</option>
          </select>
        </div>
      ) : (
        <input className="input" aria-label="Tu pronóstico" placeholder="Tu pronóstico (p. ej. 2-1)" value={choice.text ?? ''} onChange={e => apply({ ...choice, text: e.target.value })} />
      )}
      {leg.pick ? <p className="subtle">{leg.market}: <b>{leg.pick}</b>{leg.fixtureId && leg.marketKey ? ' · se resolverá sola' : ' · la revisará el equipo'}</p> : null}
      {onRemove ? <button type="button" className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={onRemove}><Trash2 size={15} aria-hidden /> Quitar</button> : null}
    </fieldset>
  );
}
