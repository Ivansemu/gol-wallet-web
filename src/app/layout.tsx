import type { Metadata, Viewport } from 'next';
import '@fontsource/sora/700.css';
import '@fontsource/sora/800.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/jetbrains-mono/800.css';
import './globals.css';
import { AuthProvider } from '../components/auth';
import { SiteHeader } from '../components/SiteHeader';
import { SiteFooter } from '../components/SiteFooter';
import { SITE_URL } from '../lib/supabase';
import { palettesByScheme } from '../shared/theme/tokens';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Gol-Wallet · Tu cartera de boletos de apuestas y lotería', template: '%s · Gol-Wallet' },
  description: 'Guarda tus boletos de apuestas deportivas y de lotería, sigue su estado, comprueba premios y controla lo que juegas. La misma cuenta en la web y en la app.',
  icons: { icon: '/favicon.png', apple: '/icon.png' },
  openGraph: { type: 'website', locale: 'es_ES', siteName: 'Gol-Wallet' },
};

export const viewport: Viewport = { themeColor: palettesByScheme.sport.light.hero, width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body data-section="sport">
        <AuthProvider>
          <a href="#contenido" className="sr-only">Saltar al contenido</a>
          <SiteHeader />
          <div className="rg-strip">
            <div className="wrap"><span className="badge18" aria-hidden>+18</span> Gol-Wallet no es una casa de apuestas. Juega con responsabilidad: <a href="/juego-responsable/">herramientas y ayuda</a>.</div>
          </div>
          <main id="contenido">{children}</main>
          <SiteFooter />
        </AuthProvider>
      </body>
    </html>
  );
}
