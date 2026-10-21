'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './auth';

const NAV = [
  { href: '/cartera/', label: 'Mi cartera', match: '/cartera' },
  { href: '/loteria/', label: 'Comprobar lotería', match: '/loteria' },
  { href: '/herramientas/', label: 'Herramientas', match: '/herramientas' },
  { href: '/casas/', label: 'Casas con licencia', match: '/casas' },
  { href: '/juego-responsable/', label: 'Juego responsable', match: '/juego-responsable' },
];

export function SiteHeader() {
  const path = usePathname() ?? '/';
  const { user } = useAuth();
  return (
    <header className="site-header" data-section="sport">
      <div className="wrap bar">
        <Link href="/" className="logo" aria-label="Gol-Wallet, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logotipo-blanco.svg" alt="Gol-Wallet" width={160} height={27} />
        </Link>
        <nav className="site-nav" aria-label="Principal">
          {NAV.map(n => (
            <Link key={n.href} href={n.href} aria-current={path.startsWith(n.match) ? 'page' : undefined}>{n.label}</Link>
          ))}
          {user
            ? <Link href="/cartera/perfil/" className="cta" aria-current={path.startsWith('/cartera/perfil') ? 'page' : undefined}>Mi cuenta</Link>
            : <Link href="/cuenta/entrar/" className="cta">Entrar</Link>}
        </nav>
      </div>
    </header>
  );
}
