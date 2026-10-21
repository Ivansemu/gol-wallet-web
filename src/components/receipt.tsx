// Piezas «Recibo» para la web (equivalentes a src/components/receipt.tsx de la app): tique, cabecera en mono,
// corte, «etiqueta ···· valor», rotulador, sello y código de barras.
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

export function Receipt({ children, href, flat, className = '', label }: { children: ReactNode; href?: string; flat?: boolean; className?: string; label?: string }) {
  const cls = `paper${flat ? ' flat' : ''} ${className}`;
  return href
    ? <Link href={href} className={cls} aria-label={label}>{children}</Link>
    : <div className={cls} aria-label={label}>{children}</div>;
}

export function ReceiptHead({ left, right }: { left: string; right?: string }) {
  return <div className="receipt-head"><span>{left}</span>{right ? <span>{right}</span> : null}</div>;
}

export const Cut = () => <hr className="cut" aria-hidden />;

export function Leader({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div className={`leader${strong ? ' strong' : ''}`}>
      <span>{label}</span><span className="dots" aria-hidden /><b style={color ? { color } : undefined}>{value}</b>
    </div>
  );
}

export const Marker = ({ children, label }: { children: ReactNode; label?: string }) =>
  <span className="marker" aria-label={label}>{children}</span>;

export type StampKind = 'open' | 'won' | 'lost' | 'void' | 'live' | 'warn' | 'cashout';
export function Stamp({ kind, label, Icon, small }: { kind: StampKind; label: string; Icon?: LucideIcon; small?: boolean }) {
  return <span className={`stamp ${kind}${small ? ' sm' : ''}`}>{Icon ? <Icon size={small ? 11 : 13} strokeWidth={2.6} aria-hidden /> : null}{label}</span>;
}

/** Código de barras decorativo, estable para cada boleto (mismo algoritmo que la app). */
export function Barcode({ seed, caption }: { seed: string; caption?: string }) {
  let h = 2166136261;
  for (const c of seed || 'gol-wallet') { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const bars: { w: number; gap: number }[] = [];
  let x = 0;
  while (x < 320) {
    h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
    const w = 1 + (h % 4), gap = 1 + ((h >>> 4) % 3);
    bars.push({ w, gap }); x += w + gap;
  }
  return (
    <div style={{ display: 'grid', gap: 4, justifyItems: 'center' }} aria-hidden>
      <div className="barcode">{bars.map((b, i) => <i key={i} style={{ width: b.w, marginRight: b.gap }} />)}</div>
      {caption ? <span className="receipt-head" style={{ fontSize: 10 }}>{caption}</span> : null}
    </div>
  );
}
