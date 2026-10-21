'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, History, Home, PlusCircle, User } from 'lucide-react';
import { RequireAuth } from '../../components/auth';

const TABS = [
  { href: '/cartera/', label: 'Inicio', Icon: Home, exact: true },
  { href: '/cartera/historial/', label: 'Historial', Icon: History },
  { href: '/cartera/nuevo/', label: 'Añadir boleto', Icon: PlusCircle },
  { href: '/cartera/estadisticas/', label: 'Estadísticas', Icon: BarChart3 },
  { href: '/cartera/perfil/', label: 'Perfil', Icon: User },
];

/** Cartera privada: nunca muestra ofertas de afiliados. */
export default function CarteraLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? '';
  return (
    <RequireAuth>
      <div className="wrap" style={{ paddingTop: 20 }}>
        <nav aria-label="Cartera" className="seg" style={{ marginBottom: 8 }}>
          {TABS.map(({ href, label, Icon, exact }) => {
            const on = exact ? path === href || path === href.slice(0, -1) : path.startsWith(href.slice(0, -1));
            return (
              <Link key={href} href={href} aria-current={on ? 'page' : undefined} className="row"
                style={{ gap: 6, minHeight: 44, padding: '0 14px', borderRadius: 999, textDecoration: 'none', fontWeight: 700, fontSize: 14,
                  background: on ? 'var(--surface)' : 'transparent', color: on ? 'var(--ink)' : 'var(--ink-muted)' }}>
                <Icon size={17} aria-hidden /> {label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </RequireAuth>
  );
}
