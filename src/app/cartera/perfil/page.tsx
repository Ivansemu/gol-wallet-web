'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Download, EyeOff, LogOut, PauseCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../../components/auth';
import { deleteMyAccount, exportMyData, myPlan, mySafety, setSafety, signOut, type Safety } from '../../../lib/api';
import { planText, type MyPremium } from '../../../shared/lib/plan';
import { Leader, Receipt, ReceiptHead } from '../../../components/receipt';

const PAUSES = [1, 7, 30, 90, 180, 365];
const day = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

export default function Perfil() {
  const { user } = useAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<MyPremium | null | undefined>(undefined);
  const [safety, setSafetyState] = useState<Safety | null>(null);
  const [pauseDays, setPauseDays] = useState(7);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState('');

  useEffect(() => { myPlan().then(setPlan).catch(() => setPlan(null)); mySafety().then(setSafetyState).catch(() => {}); }, []);
  const paused = !!safety?.pause_until && Date.parse(safety.pause_until) > Date.now();

  const run = async (fn: () => Promise<void>, ok: string) => {
    setMsg(null);
    try { await fn(); setMsg({ ok: true, text: ok }); } catch (e: any) { setMsg({ ok: false, text: e?.message ?? 'No se pudo hacer.' }); }
  };

  return (
    <div className="stack" style={{ paddingTop: 12, maxWidth: 760 }}>
      <h1 style={{ fontSize: 30 }}>Perfil</h1>
      <Receipt>
        <ReceiptHead left="Tu cuenta" right="Web y app" />
        <div style={{ marginTop: 12 }}>
          <Leader label="Email" value={user?.email ?? '—'} />
          <Leader label="Tu plan" value={plan === undefined ? '…' : planText(plan ?? null)} strong />
          {plan?.account_status === 'suspended' && <Leader label="Estado" value="Suspendida" color="var(--st-lost-fg)" />}
        </div>
        <p style={{ fontSize: 13, marginTop: 10, color: 'var(--paper-muted)' }}>El plan lo decide el servidor. Las suscripciones se gestionan en la tienda del móvil (la web no cobra nada).</p>
      </Receipt>

      <section className="card stack-sm" aria-labelledby="pausa">
        <h2 id="pausa" className="row" style={{ fontSize: 20 }}><PauseCircle size={20} aria-hidden /> Pausa</h2>
        {paused ? <p>Estás en pausa hasta el <b>{day(safety!.pause_until!)}</b>. No puedes añadir boletos ni ver ofertas. La pausa no se puede acortar.</p>
          : <p className="muted">Durante la pausa no podrás añadir boletos y no verás ofertas de casas en la web. No se puede deshacer antes de tiempo.</p>}
        <div className="row">
          <select className="input" style={{ maxWidth: 200 }} aria-label="Duración de la pausa" value={pauseDays} onChange={e => setPauseDays(Number(e.target.value))}>
            {PAUSES.map(d => <option key={d} value={d}>{d === 1 ? '1 día' : `${d} días`}</option>)}
          </select>
          <button className="btn sm" onClick={() => {
            if (!confirm(`¿Pausar ${pauseDays} ${pauseDays === 1 ? 'día' : 'días'}? No podrás acortarla.`)) return;
            void run(async () => setSafetyState(await setSafety(pauseDays, null)), 'Pausa activada.');
          }}>{paused ? 'Alargar pausa' : 'Activar pausa'}</button>
        </div>
        <p className="subtle">Si necesitas más, el Registro General de Interdicciones de Acceso al Juego (RGIAJ) te excluye de todas las casas con licencia.</p>
      </section>

      <section className="card stack-sm" aria-labelledby="ofertas">
        <h2 id="ofertas" className="row" style={{ fontSize: 20 }}><EyeOff size={20} aria-hidden /> Ofertas de casas</h2>
        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" style={{ width: 22, height: 22 }} checked={!!safety?.hide_offers}
            onChange={e => void run(async () => setSafetyState(await setSafety(null, e.target.checked)), e.target.checked ? 'No verás ofertas de casas.' : 'Preferencia guardada.')} />
          No quiero ver ofertas de casas de apuestas en la web
        </label>
        <p className="subtle">Tu cartera nunca muestra ofertas. Esto las oculta también en el resto de la web mientras tengas la sesión iniciada.</p>
      </section>

      <section className="card stack-sm" aria-labelledby="datos">
        <h2 id="datos" style={{ fontSize: 20 }}>Tus datos</h2>
        <div className="row">
          <button className="btn ghost sm" onClick={() => void run(async () => {
            const data = await exportMyData();
            const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
            const a = Object.assign(document.createElement('a'), { href: url, download: `gol-wallet-datos-${new Date().toISOString().slice(0, 10)}.json` });
            a.click(); URL.revokeObjectURL(url);
          }, 'Descarga preparada.')}><Download size={16} aria-hidden /> Descargar mis datos</button>
          <button className="btn ghost sm" onClick={async () => { await signOut(); router.replace('/'); }}><LogOut size={16} aria-hidden /> Cerrar sesión</button>
        </div>
        <details>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontWeight: 700, color: 'var(--st-lost-fg)' }}>Borrar mi cuenta</summary>
          <div className="stack-sm" style={{ marginTop: 8 }}>
            <p>Se borran tu cuenta y todos tus boletos del servidor, también en la app. No se puede deshacer. Si tienes una suscripción, cancélala antes en la tienda.</p>
            <label htmlFor="borrar" className="hint">Escribe BORRAR para confirmar</label>
            <div className="row">
              <input id="borrar" className="input" style={{ maxWidth: 200 }} value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)} />
              <button className="btn danger sm" disabled={confirmDelete !== 'BORRAR'} onClick={() => void run(async () => { await deleteMyAccount(); router.replace('/'); }, 'Cuenta borrada.')}>
                <Trash2 size={16} aria-hidden /> Borrar definitivamente</button>
            </div>
          </div>
        </details>
      </section>
      {msg && <p className={msg.ok ? 'ok' : 'error'} role={msg.ok ? 'status' : 'alert'}>{msg.ok ? <CheckCircle2 size={16} aria-hidden /> : <AlertCircle size={16} aria-hidden />} {msg.text}</p>}
    </div>
  );
}
