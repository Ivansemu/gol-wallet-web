'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Camera, PauseCircle, Pencil, Plus } from 'lucide-react';
import { createSlip, fixturesToPick, readTicketPhoto } from '../../../lib/api';
import { manualErrors, manualTicket, reviewFromScan, type ManualInput, type ManualLeg } from '../../../lib/wallet';
import { useWallet } from '../../../lib/useWallet';
import { LegEditor } from '../../../components/LegEditor';
import { Leader, Receipt, ReceiptHead } from '../../../components/receipt';
import type { FixtureOption } from '../../../shared/lib/manualMarkets';
import { formatEuro, formatOdds } from '../../../shared/utils/format';

const emptyLeg = (): ManualLeg => ({ home: '', away: '', market: '', pick: '', odds: null });
const num = (s: string) => { const x = Number(s.replace(/[€\s]/g, '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };

export default function Nuevo() {
  const router = useRouter();
  const { paused, safety } = useWallet();
  const [mode, setMode] = useState<'foto' | 'mano'>('foto');
  const [fixtures, setFixtures] = useState<FixtureOption[] | null>(null);
  const [input, setInput] = useState<ManualInput>({ operator: '', stake: 0, legs: [emptyLeg()] });
  const [stakeText, setStakeText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fixturesToPick().then(setFixtures).catch(() => setFixtures([])); }, []);

  if (paused) {
    return <div className="notice info" role="status" style={{ marginTop: 16 }}><PauseCircle size={18} aria-hidden />
      Estás en pausa hasta el {new Date(safety!.pause_until!).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}. Mientras tanto no se pueden añadir boletos.</div>;
  }

  const onPhoto = async (file?: File) => {
    if (!file) return;
    setErrors([]); setBusy('Leyendo el boleto…');
    const r = await readTicketPhoto(file);
    setBusy('');
    if (!r.ok) { setErrors([r.message]); return; }
    const review = reviewFromScan(r.ticket);
    setInput(review.legs.length ? review : { ...review, legs: [emptyLeg()] });
    setStakeText(review.stake ? String(review.stake).replace('.', ',') : '');
    setMode('mano');
  };

  const save = async () => {
    const data = { ...input, stake: num(stakeText) };
    const errs = manualErrors(data);
    setErrors(errs);
    if (errs.length) return;
    setBusy('Guardando…');
    try {
      const id = await createSlip(manualTicket(data));
      router.replace(`/cartera/boleto/?id=${id}`);
    } catch (e: any) {
      setErrors([e?.message?.includes('row-level') ? 'Tu cuenta no puede añadir boletos ahora mismo (cuenta suspendida).' : e?.message ?? 'No se pudo guardar.']);
      setBusy('');
    }
  };

  const preview = manualTicket({ ...input, stake: num(stakeText) || 0 });
  const setLeg = (i: number, l: ManualLeg) => setInput(p => ({ ...p, legs: p.legs.map((x, j) => (j === i ? l : x)) }));

  return (
    <div className="stack" style={{ paddingTop: 12 }}>
      <h1 style={{ fontSize: 30 }}>Añadir boleto</h1>
      <div className="seg" role="group" aria-label="Cómo añadirlo">
        <button aria-pressed={mode === 'foto'} onClick={() => setMode('foto')}><Camera size={15} aria-hidden /> Con foto</button>
        <button aria-pressed={mode === 'mano'} onClick={() => setMode('mano')}><Pencil size={15} aria-hidden /> A mano</button>
      </div>

      {mode === 'foto' ? (
        <div className="stack" style={{ maxWidth: 560 }}>
          <button type="button" className="drop" onClick={() => fileRef.current?.click()} disabled={!!busy}>
            <Camera size={32} aria-hidden />
            <strong>{busy || 'Sube la foto o captura del boleto'}</strong>
            <span className="hint">JPG o PNG. Después podrás revisar todo antes de guardarlo.</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={e => onPhoto(e.target.files?.[0])} />
          <p className="subtle">La foto se envía a nuestro lector solo para extraer los datos; no se guarda la imagen. Cuenta como una lectura de tu plan.</p>
        </div>
      ) : (
        <div className="grid-2" style={{ alignItems: 'start' }}>
          <form className="stack" onSubmit={e => { e.preventDefault(); void save(); }}>
            <div className="grid-2" style={{ gap: 10 }}>
              <div className="field"><label htmlFor="casa">Casa de apuestas</label>
                <input id="casa" className="input" placeholder="Nombre de la casa" value={input.operator} onChange={e => setInput({ ...input, operator: e.target.value })} /></div>
              <div className="field"><label htmlFor="importe">Importe apostado</label>
                <input id="importe" className="input" inputMode="decimal" placeholder="10,00 €" value={stakeText} onChange={e => setStakeText(e.target.value)} /></div>
            </div>
            {input.legs.map((l, i) => (
              <LegEditor key={i} n={i + 1} leg={l} fixtures={fixtures} onChange={x => setLeg(i, x)}
                onRemove={input.legs.length > 1 ? () => setInput(p => ({ ...p, legs: p.legs.filter((_, j) => j !== i) })) : undefined} />
            ))}
            <button type="button" className="btn ghost" onClick={() => setInput(p => ({ ...p, legs: [...p.legs, emptyLeg()] }))}><Plus size={16} aria-hidden /> Otra selección</button>
            {errors.length > 0 && <div className="stack-sm" role="alert">{errors.map(e => <p key={e} className="error"><AlertCircle size={16} aria-hidden /> {e}</p>)}</div>}
            <button className="btn lime" disabled={!!busy}>{busy || 'Guardar boleto'}</button>
          </form>
          <Receipt>
            <ReceiptHead left={preview.operator} right={input.entry === 'scan' ? 'Leído de la foto' : 'A mano'} />
            <div style={{ marginTop: 12 }}>
              <Leader label="Selecciones" value={String(input.legs.length)} />
              <Leader label="Apostado" value={formatEuro(preview.stake || 0)} />
              <Leader label="Cuota" value={preview.finalOdds ? formatOdds(preview.finalOdds) : '—'} />
              <Leader label="Premio posible" value={formatEuro(preview.maxWin || 0)} strong />
            </div>
          </Receipt>
        </div>
      )}
      {mode === 'foto' && errors.length > 0 && <div role="alert">{errors.map(e => <p key={e} className="error"><AlertCircle size={16} aria-hidden /> {e}</p>)}</div>}
    </div>
  );
}
