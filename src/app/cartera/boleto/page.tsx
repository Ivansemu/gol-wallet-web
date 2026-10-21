'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Radio, Trash2 } from 'lucide-react';
import { useWallet } from '../../../lib/useWallet';
import { useQuery } from '../../../lib/useQuery';
import { deleteSlip, setCashout } from '../../../lib/api';
import { Barcode, Cut, Leader, Marker, Receipt, ReceiptHead } from '../../../components/receipt';
import { StatusStamp, legStamp } from '../../../components/status';
import { title } from '../../../components/TicketCard';
import { matchSelections } from '../../../shared/lib/betSync';
import { selectionInsight } from '../../../shared/lib/selectionInsight';
import { cashoutCap, cashoutError, parseAmount, ticketReturn } from '../../../shared/lib/cashout';
import { formatEuro, formatOdds, formatProfit } from '../../../shared/utils/format';

const when = (iso?: string) => iso && !Number.isNaN(Date.parse(iso))
  ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

export default function Boleto() {
  const id = useQuery('id');
  const router = useRouter();
  const { tickets, remote, reload } = useWallet();
  const [cash, setCash] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  if (id === undefined || !tickets) return <p className="muted" role="status">Cargando…</p>;
  const t = tickets.find(x => x._raw.remoteId === id || x.id === id);
  if (!t) return <div className="stack" style={{ paddingTop: 16 }}><p>No encuentro ese boleto en tu cuenta.</p><Link href="/cartera/historial/">Volver al historial</Link></div>;

  const slip = t._raw.remoteId ? remote[t._raw.remoteId] : undefined;
  const sels = slip ? matchSelections(slip, t._raw.events ?? []) : [];
  const cap = cashoutCap(t._raw);
  const settled = t.status !== 'abierta';

  const saveCashout = async (amount: number | null) => {
    const err = amount == null ? null : cashoutError(amount, cap);
    if (err) { setMsg(err); return; }
    setBusy(true); setMsg('');
    try { await setCashout(t._raw.remoteId, amount); setCash(''); await reload(); }
    catch (e: any) { setMsg(e?.message ?? 'No se pudo guardar.'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!confirm('¿Borrar este boleto de tu cuenta? Desaparece también de la app.')) return;
    setBusy(true);
    try { await deleteSlip(t._raw.remoteId); router.replace('/cartera/historial/'); }
    catch (e: any) { setMsg(e?.message ?? 'No se pudo borrar.'); setBusy(false); }
  };

  return (
    <div className="stack" style={{ paddingTop: 12, maxWidth: 720 }}>
      <Link href="/cartera/historial/" className="row" style={{ minHeight: 44 }}><ArrowLeft size={18} aria-hidden /> Historial</Link>
      <Receipt>
        <ReceiptHead left={t.operator} right={when(t.placedAt)} />
        <div className="between" style={{ margin: '12px 0' }}>
          <h1 style={{ fontSize: 24 }}>{title(t)}</h1>
          <StatusStamp status={t.status} />
        </div>
        <p className="overline" style={{ color: 'var(--paper-muted)' }}>{settled ? 'Resultado' : 'Premio posible'}</p>
        <Marker>{settled ? formatProfit(ticketReturn(t) - t.stake) : formatEuro(t.maxWin)}</Marker>
        <div style={{ marginTop: 12 }}>
          <Leader label="Apostado" value={formatEuro(t.stake)} />
          {t.finalOdds > 0 && <Leader label="Cuota total" value={formatOdds(t.finalOdds)} />}
          {t.status === 'cobrada' && <Leader label="Cobrado (cash out)" value={formatEuro(t.cashout ?? 0)} strong />}
          {t.payout != null && t.status !== 'cobrada' && <Leader label="Devuelve" value={formatEuro(t.payout)} strong />}
        </div>
        <Cut />
        <p className="overline" style={{ color: 'var(--paper-muted)', marginBottom: 8 }}>Selecciones</p>
        <ol className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {t.events.map((e, i) => {
            const ins = selectionInsight(sels[i], { home: e.home ?? 'Local', away: e.away ?? 'Visitante' });
            return (
              <li key={i} className="stack-sm" style={{ borderBottom: '1px dotted var(--paper-rule)', paddingBottom: 10 }}>
                <div className="between"><strong>{e.home ?? '?'} - {e.away ?? '?'}</strong>{legStamp(t.legs[i] ?? 'pending')}</div>
                <span className="mono" style={{ fontSize: 13 }}>{[e.market, e.selection ?? e.pick].filter(Boolean).join(': ')}{e.odds ? ` · ${formatOdds(e.odds)}` : ''}</span>
                <span className="row" style={{ fontSize: 13, color: 'var(--paper-muted)', gap: 6 }}>
                  {ins.phase === 'live' && <Radio size={14} aria-hidden />}
                  {ins.score ? <b className="mono">{ins.score}</b> : null}{ins.minute != null ? <span className="mono">{ins.minute}&apos;</span> : null}
                  <span>{ins.title}{ins.detail ? ` · ${ins.detail}` : ''}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <Cut />
        <Barcode seed={t._raw.remoteId ?? t.id} caption={t._raw.ticketId ? `Ref. ${t._raw.ticketId}` : t._raw.source === 'web' ? 'Añadido en la web' : 'Gol-Wallet'} />
      </Receipt>

      {t._raw.remoteId && (t.status === 'abierta' || t.status === 'cobrada') && (
        <div className="card stack-sm">
          <h2 style={{ fontSize: 18 }}>¿Has hecho cash out en tu casa?</h2>
          <p className="muted" style={{ fontSize: 14 }}>Apunta lo que te pagaron para que tu balance sea real. {cap ? `Como mucho ${formatEuro(cap)}.` : ''}</p>
          <div className="row">
            <input className="input" style={{ maxWidth: 180 }} inputMode="decimal" placeholder="0,00 €" aria-label="Importe cobrado" value={cash} onChange={e => setCash(e.target.value)} />
            <button className="btn sm" disabled={busy || !cash} onClick={() => { const a = parseAmount(cash); if (a == null) setMsg(cashoutError(null, cap) ?? ''); else void saveCashout(a); }}>Guardar cobro</button>
            {t.status === 'cobrada' && <button className="btn ghost sm" disabled={busy} onClick={() => saveCashout(null)}>Quitar cash out</button>}
          </div>
        </div>
      )}
      {msg ? <p className="error" role="alert"><AlertCircle size={16} aria-hidden /> {msg}</p> : null}
      {t._raw.remoteId && <button className="btn danger sm" style={{ justifySelf: 'start' }} onClick={remove} disabled={busy}><Trash2 size={16} aria-hidden /> Borrar boleto</button>}
    </div>
  );
}
