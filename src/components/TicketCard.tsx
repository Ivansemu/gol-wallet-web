import type { SportsTicket } from '../shared/lib/sportsTickets';
import { ticketReturn } from '../shared/lib/cashout';
import { formatEuro, formatOdds, formatProfit } from '../shared/utils/format';
import { Leader, Receipt, ReceiptHead } from './receipt';
import { StatusStamp } from './status';

const day = (iso?: string) => iso && !Number.isNaN(Date.parse(iso))
  ? new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';

export function title(t: SportsTicket) {
  const n = t.events.length;
  if (n === 1) { const e = t.events[0]; return `${e.home ?? '?'} - ${e.away ?? '?'}`; }
  return n ? `Combinada de ${n}` : 'Boleto';
}

/** Tique de la lista (Inicio, Historial): título, estado y lo esencial en líneas de puntos. */
export function TicketCard({ t }: { t: SportsTicket }) {
  const settled = t.status !== 'abierta';
  return (
    <Receipt href={`/cartera/boleto/?id=${encodeURIComponent(t._raw.remoteId ?? t.id)}`} label={`${title(t)}, ${t.status}`}>
      <ReceiptHead left={t.operator} right={day(t.placedAt)} />
      <div className="between" style={{ margin: '10px 0 6px' }}>
        <strong className="heading" style={{ fontSize: 17 }}>{title(t)}</strong>
        <StatusStamp status={t.status} small />
      </div>
      <Leader label="Apostado" value={formatEuro(t.stake)} />
      {t.finalOdds > 0 && <Leader label="Cuota" value={formatOdds(t.finalOdds)} />}
      {settled
        ? <Leader label="Resultado" value={formatProfit(ticketReturn(t) - t.stake)} strong />
        : <Leader label="Premio posible" value={formatEuro(t.maxWin)} strong />}
    </Receipt>
  );
}
