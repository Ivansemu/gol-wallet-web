'use client';
import Link from 'next/link';
import { Ban, Camera, Check, Clock, HandCoins, PauseCircle, X } from 'lucide-react';
import { useWallet } from '../../lib/useWallet';
import { Cut, Leader, Marker, Receipt, ReceiptHead } from '../../components/receipt';
import { TicketCard } from '../../components/TicketCard';
import { formatEuro, formatOdds, formatProfit } from '../../shared/utils/format';

export default function Inicio() {
  const { tickets, stats, paused, safety, error } = useWallet();
  if (!tickets) return <p className="muted" role="status" style={{ padding: '24px 0' }}>Cargando tus boletos…</p>;
  const open = tickets.filter(t => t.status === 'abierta');
  const now = new Date().toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="stack" style={{ paddingTop: 12 }}>
      {error ? <div className="notice" role="alert">{error}</div> : null}
      {paused && (
        <div className="notice info" role="status"><PauseCircle size={18} aria-hidden />
          Estás en pausa hasta el {new Date(safety!.pause_until!).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}. Puedes consultar tus boletos, pero no añadir nuevos.</div>
      )}
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <Receipt>
          <ReceiptHead left="Resumen · Deportes" right={now} />
          <Cut />
          <p className="overline" style={{ color: 'var(--paper-muted)' }}>Premio posible</p>
          <Marker label={`Premio posible ${formatEuro(stats.potential)}`}>{formatEuro(stats.potential)}</Marker>
          <div style={{ marginTop: 12 }}>
            <Leader label="Boletos" value={String(stats.count)} />
            <Leader label="Apostado" value={formatEuro(stats.stake)} />
            {stats.avgOdds != null && <Leader label="Cuota media" value={formatOdds(stats.avgOdds)} />}
            <Leader label="Balance" value={stats.balance == null ? '—' : formatProfit(stats.balance)} strong />
          </div>
        </Receipt>
        <div className="stack">
          <div className="kpis">
            <div className="kpi"><span className="row subtle"><Check size={14} aria-hidden /> Ganados</span><b>{stats.won}</b></div>
            <div className="kpi"><span className="row subtle"><X size={14} aria-hidden /> Perdidos</span><b>{stats.lost}</b></div>
            <div className="kpi"><span className="row subtle"><Clock size={14} aria-hidden /> En juego</span><b>{stats.open}</b></div>
            <div className="kpi"><span className="row subtle"><HandCoins size={14} aria-hidden /> Cobrados</span><b>{stats.cashedOut}</b></div>
            {stats.voided ? <div className="kpi"><span className="row subtle"><Ban size={14} aria-hidden /> Anulados</span><b>{stats.voided}</b></div> : null}
          </div>
          {!paused && <Link href="/cartera/nuevo/" className="btn lime block"><Camera size={18} aria-hidden /> Añadir boleto</Link>}
          <p className="subtle">El estado lo decide el servidor (resultados oficiales y revisión del equipo). Lo que ves aquí es lo mismo que en la app.</p>
        </div>
      </div>

      <section className="stack" aria-labelledby="abiertos">
        <div className="between"><h2 id="abiertos">En juego</h2><Link href="/cartera/historial/">Ver historial</Link></div>
        {open.length ? <div className="grid-2">{open.slice(0, 8).map(t => <TicketCard key={t.id} t={t} />)}</div>
          : <p className="muted">No tienes boletos abiertos. {tickets.length ? '' : 'Añade el primero con una foto o a mano.'}</p>}
      </section>
    </div>
  );
}
