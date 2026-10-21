import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="site-footer" data-section="sport">
      <div className="wrap">
        <div className="cols">
          <div className="stack-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logotipo-blanco.svg" alt="Gol-Wallet" width={150} height={25} />
            <p>Tu cartera de boletos: deportes y lotería en un solo sitio. Gol-Wallet no es una casa de apuestas ni acepta apuestas.</p>
          </div>
          <div>
            <h4>Producto</h4>
            <ul>
              <li><Link href="/cartera/">Mi cartera</Link></li>
              <li><Link href="/loteria/">Comprobar lotería</Link></li>
              <li><Link href="/herramientas/">Herramientas</Link></li>
              <li><Link href="/#app">App para móvil</Link></li>
            </ul>
          </div>
          <div>
            <h4>Casas y juego seguro</h4>
            <ul>
              <li><Link href="/casas/">Casas con licencia DGOJ</Link></li>
              <li><Link href="/juego-responsable/">Juego responsable</Link></li>
              <li><a href="https://www.jugarbien.es" rel="noopener" target="_blank">jugarbien.es</a></li>
              <li><a href="https://www.ordenacionjuego.es/participantes-juego/registro-general-interdicciones-acceso-juego" rel="noopener" target="_blank">Autoprohibición (RGIAJ)</a></li>
            </ul>
          </div>
          <div>
            <h4>Legal</h4>
            <ul>
              <li><Link href="/legal/aviso-legal/">Aviso legal y condiciones</Link></li>
              <li><Link href="/legal/privacidad/">Privacidad</Link></li>
              <li><Link href="/legal/cookies/">Cookies</Link></li>
              <li><Link href="/legal/afiliacion/">Cómo nos financiamos</Link></li>
            </ul>
          </div>
        </div>
        <div className="legal">
          <p><span className="badge18" aria-label="Solo mayores de 18 años">+18</span> El juego puede crear adicción. Juega con responsabilidad. Prohibido a menores.</p>
          <p>Algunos enlaces de «Casas con licencia» son de afiliación: si te registras, Gol-Wallet puede recibir una comisión. Nunca dentro de tu cartera.</p>
        </div>
      </div>
    </footer>
  );
}
