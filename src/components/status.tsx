import { Ban, Check, Clock, HandCoins, X } from 'lucide-react';
import type { BetStatus } from '../shared/lib/sportsTickets';
import { Stamp, type StampKind } from './receipt';

const MAP: Record<BetStatus, { kind: StampKind; label: string; Icon: typeof Check }> = {
  abierta: { kind: 'open', label: 'Abierta', Icon: Clock },
  ganada: { kind: 'won', label: 'Ganada', Icon: Check },
  perdida: { kind: 'lost', label: 'Perdida', Icon: X },
  cobrada: { kind: 'cashout', label: 'Cobrada', Icon: HandCoins },
  anulada: { kind: 'void', label: 'Anulada', Icon: Ban },
};

/** Estado del boleto como sello: siempre icono + texto. */
export function StatusStamp({ status, small }: { status: BetStatus; small?: boolean }) {
  const m = MAP[status];
  return <Stamp kind={m.kind} label={m.label} Icon={m.Icon} small={small} />;
}

export const legStamp = (l: 'pending' | 'won' | 'lost' | 'void') =>
  l === 'won' ? <Stamp kind="won" label="Acertada" Icon={Check} small />
  : l === 'lost' ? <Stamp kind="lost" label="Fallada" Icon={X} small />
  : l === 'void' ? <Stamp kind="void" label="Nula" Icon={Ban} small />
  : <Stamp kind="open" label="Pendiente" Icon={Clock} small />;
