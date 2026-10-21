'use client';
import { useState } from 'react';
import { useWallet } from '../../../lib/useWallet';
import { TicketCard } from '../../../components/TicketCard';
import { filterTickets, type FilterKey } from '../../../shared/lib/sportsTickets';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'todas', label: 'Todas' }, { key: 'abierta', label: 'Abiertas' }, { key: 'ganada', label: 'Ganadas' },
  { key: 'perdida', label: 'Perdidas' }, { key: 'cobrada', label: 'Cobradas' }, { key: 'anulada', label: 'Anuladas' },
];

export default function Historial() {
  const { tickets, error } = useWallet();
  const [filter, setFilter] = useState<FilterKey>('todas');
  const [q, setQ] = useState('');
  if (!tickets) return <p className="muted" role="status">Cargando…</p>;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = filterTickets(tickets, filter).filter(t => !q.trim() || norm([t.operator, ...t.events.flatMap(e => [e.home, e.away, e.market, e.selection, e.pick])].filter(Boolean).join(' ')).includes(norm(q.trim())));
  return (
    <div className="stack" style={{ paddingTop: 12 }}>
      <h1 style={{ fontSize: 30 }}>Historial</h1>
      {error ? <div className="notice" role="alert">{error}</div> : null}
      <div className="between">
        <div className="seg" role="group" aria-label="Filtrar por estado">
          {FILTERS.map(f => <button key={f.key} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>)}
        </div>
        <input className="input" style={{ maxWidth: 300 }} placeholder="Buscar equipo, casa o mercado" aria-label="Buscar" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <p className="subtle">{list.length} {list.length === 1 ? 'boleto' : 'boletos'}</p>
      <div className="grid-2">{list.map(t => <TicketCard key={t.id} t={t} />)}</div>
    </div>
  );
}
