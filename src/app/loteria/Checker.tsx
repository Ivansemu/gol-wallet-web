'use client';
import { useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Check, Clock, X } from 'lucide-react';
import { publicDraw } from '../../lib/api';
import { backendConfigured } from '../../lib/supabase';
import { checkLotteryTicket, lotteryResultOutcome, type LotteryApiAdapter } from '../../shared/lib/lotteryChecker';
import { drawFromRow, type DrawRow } from '../../shared/lib/lotteryDraw';
import { CHECK_GAMES, GAME_SPECS, gameName, gameShort } from '../../shared/lib/lotteryGames';
import type { LotteryCheckResult, LotteryGame, LotteryTicket } from '../../shared/types/tickets';
import { formatEuro } from '../../shared/utils/format';
import { Cut, Leader, Marker, Receipt, ReceiptHead, Stamp } from '../../components/receipt';
import { DrawBalls } from '../../components/DrawBalls';

const today = () => new Date().toISOString().slice(0, 10);

export function Checker() {
  const [game, setGame] = useState<LotteryGame | null>(null);
  const [date, setDate] = useState(today());
  const [nums, setNums] = useState<number[]>([]);
  const [extra, setExtra] = useState<number[]>([]);
  const [code, setCode] = useState('');
  const [series, setSeries] = useState('');
  const [signs, setSigns] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ result: LotteryCheckResult | null; row: DrawRow | null } | null>(null);
  const [error, setError] = useState('');
  const spec = game ? GAME_SPECS[game] : undefined;

  const complete = useMemo(() => {
    if (!spec) return false;
    if (spec.kind === 'balls') return nums.length === spec.pick && (!spec.extra || extra.length === spec.extra.pick);
    if (spec.kind === 'number') return code.length === spec.digits;
    return signs.filter(Boolean).length === spec.matches;
  }, [spec, nums, extra, code, signs]);

  const reset = (g: LotteryGame | null) => { setGame(g); setNums([]); setExtra([]); setCode(''); setSeries(''); setSigns([]); setOut(null); setError(''); };
  const toggle = (list: number[], set: (v: number[]) => void, n: number, max: number) =>
    set(list.includes(n) ? list.filter(x => x !== n) : list.length < max ? [...list, n].sort((a, b) => a - b) : list);

  // Mismo ticket que arma la pantalla Comprobar de la app
  const ticket = (): LotteryTicket => {
    const base = { type: 'lottery' as const, game: game!, drawDate: date, scannedAt: new Date().toISOString(), stake: 0, draws: 1 };
    if (spec?.kind === 'number') return { ...base, onceNumber: code, onceSeries: series || undefined, lines: [{ numbers: [] }] } as LotteryTicket;
    if (spec?.kind === 'signs') return { ...base, lines: [{ numbers: [], picks: signs }] };
    const line: LotteryTicket['lines'][number] = { numbers: nums };
    if (spec?.kind === 'balls' && spec.extra) {
      if (game === 'euromillones' || game === 'eurodreams') line.stars = extra;
      else if (game === 'gordo') line.elKey = extra[0];
      else line.reintegro = extra[0];
    }
    return { ...base, lines: [line] };
  };

  const check = async () => {
    if (!complete || !game) return;
    setBusy(true); setError('');
    try {
      let row: DrawRow | null = null;
      const adapter: LotteryApiAdapter = {
        isAvailable: () => true, getLastDraw: async () => null,
        getDrawByDate: async (g, d) => { row = await publicDraw(g, d.slice(0, 10)); return row ? drawFromRow(row) : null; },
      };
      const result = await checkLotteryTicket(ticket(), adapter);
      setOut({ result, row });
    } catch { setError('No se pudo consultar el sorteo. Prueba otra vez en un momento.'); }
    finally { setBusy(false); }
  };

  if (!backendConfigured()) return <div className="notice" role="alert">Esta copia de la web no tiene servidor configurado: no se pueden consultar sorteos.</div>;

  if (!game) {
    return (
      <div className="grid-3" role="list" aria-label="Elige el juego">
        {CHECK_GAMES.map(g => (
          <button key={g} role="listitem" className="card row" style={{ cursor: 'pointer', textAlign: 'left', minHeight: 72 }} onClick={() => reset(g)}>
            <span className="ball static" style={{ background: `var(--game-${g})`, color: 'var(--white)', borderColor: 'transparent' }}>{gameShort(g)}</span>
            <strong>{gameName(g)}</strong>
          </button>
        ))}
      </div>
    );
  }

  const outcome = out ? lotteryResultOutcome(out.result) : null;
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="stack">
        <button className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={() => reset(null)}><ArrowLeft size={16} aria-hidden /> Otro juego</button>
        <h2>{gameName(game)}</h2>
        <div className="field" style={{ maxWidth: 240 }}>
          <label htmlFor="fecha">Fecha del sorteo</label>
          <input id="fecha" type="date" className="input" max={today()} value={date} onChange={e => { setDate(e.target.value); setOut(null); }} />
        </div>
        {spec?.kind === 'balls' && (
          <>
            <div className="stack-sm">
              <span className="overline">Elige {spec.pick} números ({nums.length}/{spec.pick})</span>
              <div className="balls" role="group" aria-label="Números">
                {Array.from({ length: spec.max - (spec.min ?? 1) + 1 }, (_, i) => i + (spec.min ?? 1)).map(n => (
                  <button key={n} className="ball" aria-pressed={nums.includes(n)} onClick={() => toggle(nums, setNums, n, spec.pick)}>{n}</button>
                ))}
              </div>
            </div>
            {spec.extra && (
              <div className="stack-sm">
                <span className="overline">{spec.extra.label} ({extra.length}/{spec.extra.pick})</span>
                <div className="balls" role="group" aria-label={spec.extra.label}>
                  {Array.from({ length: spec.extra.max - spec.extra.min + 1 }, (_, i) => i + spec.extra!.min).map(n => (
                    <button key={n} className="ball star" aria-pressed={extra.includes(n)} onClick={() => toggle(extra, setExtra, n, spec.extra!.pick)}>{n}</button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {spec?.kind === 'number' && (
          <div className="row">
            <div className="field"><label htmlFor="num">Número ({spec.digits} cifras)</label>
              <input id="num" className="input mono" inputMode="numeric" maxLength={spec.digits} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} style={{ maxWidth: 180, fontSize: 22 }} /></div>
            {spec.series && <div className="field"><label htmlFor="serie">Serie (opcional)</label>
              <input id="serie" className="input mono" inputMode="numeric" maxLength={3} value={series} onChange={e => setSeries(e.target.value.replace(/\D/g, ''))} style={{ maxWidth: 120 }} /></div>}
          </div>
        )}
        {spec?.kind === 'signs' && (
          <div className="stack-sm">
            {Array.from({ length: spec.matches }, (_, i) => (
              <div key={i} className="row" style={{ gap: 6 }}>
                <span className="mono" style={{ width: 28 }}>{i + 1}</span>
                <div className="seg" role="group" aria-label={`Partido ${i + 1}`}>
                  {spec.signs.map(s => <button key={s} aria-pressed={signs[i] === s} onClick={() => setSigns(p => { const c = [...p]; c[i] = s; return c; })}>{s}</button>)}
                </div>
              </div>
            ))}
          </div>
        )}
        <button className="btn lime" disabled={!complete || busy} onClick={check}>{busy ? 'Comprobando…' : 'Comprobar'}</button>
        {error && <p className="error" role="alert"><AlertCircle size={16} aria-hidden /> {error}</p>}
      </div>

      <div aria-live="polite">
        {out && (
          <Receipt>
            <ReceiptHead left={gameName(game)} right={new Date(`${date}T12:00:00`).toLocaleDateString('es-ES')} />
            {!out.result ? (
              <div className="stack-sm" style={{ marginTop: 12 }}>
                <Stamp kind="warn" label="Sin resultado" Icon={Clock} />
                <p>Aún no tenemos el resultado oficial de ese sorteo. Revisa la fecha o vuelve más tarde.</p>
              </div>
            ) : (
              <>
                <div style={{ margin: '12px 0' }}>
                  {outcome === 'won' ? <Stamp kind="won" label="Premiado" Icon={Check} /> : outcome === 'lost' ? <Stamp kind="lost" label="Sin premio" Icon={X} /> : <Stamp kind="open" label="Pendiente" Icon={Clock} />}
                </div>
                {out.row && <DrawBalls row={out.row} hits={{ numbers: nums, stars: game === 'euromillones' || game === 'eurodreams' ? extra : undefined }} />}
                <Cut />
                {out.result.lineResults.map(l => (
                  <div key={l.lineIndex}>
                    <Leader label="Aciertos" value={`${l.matches}${l.starMatches != null ? ` + ${l.starMatches}` : ''}`} />
                    <Leader label="Categoría" value={l.category ?? 'Ninguna'} />
                    {l.note ? <p style={{ fontSize: 13, color: 'var(--paper-muted)' }}>{l.note}</p> : null}
                  </div>
                ))}
                <Cut />
                {out.result.prizeStatus === 'confirmed' ? (<><p className="overline" style={{ color: 'var(--paper-muted)' }}>Premio oficial</p><Marker>{formatEuro(out.result.totalPrize)}</Marker></>)
                  : out.result.prizeStatus === 'pending_amount' ? <p>Tienes premio de categoría <b>{out.result.lineResults.map(l => l.category).filter(Boolean).join(', ')}</b>. El importe oficial aún no está publicado.</p>
                  : out.result.prizeStatus === 'no_prize' ? <p>Esta vez no hay premio.</p> : <p>No se puede calcular el premio con los datos disponibles.</p>}
                {out.result.prizesSource ? <p style={{ fontSize: 12, marginTop: 8, color: 'var(--paper-muted)' }}>Fuente: {out.result.prizesSource}</p> : null}
                <p style={{ fontSize: 12, marginTop: 8, color: 'var(--paper-muted)' }}>Comprobación orientativa. El resguardo y el operador oficial son los que valen para cobrar.</p>
              </>
            )}
          </Receipt>
        )}
      </div>
    </div>
  );
}
