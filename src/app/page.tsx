import Link from 'next/link';
import { BarChart3, Camera, CheckCircle2, Clock, Gauge, Monitor, ShieldCheck, Smartphone, Ticket, Trophy } from 'lucide-react';
import { Barcode, Cut, Leader, Marker, Receipt, ReceiptHead, Stamp } from '../components/receipt';
import { Offers } from '../components/Offers';
import { LatestDraws } from './LatestDraws';

const FEATURES = [
  { Icon: Camera, title: 'Foto y listo', text: 'Haz una foto al boleto (o súbela aquí) y Gol-Wallet lee la casa, el importe, la cuota y cada selección.' },
  { Icon: Clock, title: 'Siempre al día', text: 'Marcador, minuto y si cada selección se está cumpliendo. Cuando acaba el partido, el boleto se liquida solo.' },
  { Icon: Trophy, title: 'Lotería comprobada', text: 'Euromillones, Primitiva, Bonoloto, El Gordo, Quiniela… Te decimos la categoría y el importe oficial cuando se publica.' },
  { Icon: BarChart3, title: 'Tus números de verdad', text: 'Lo apostado, lo cobrado y el balance real por mes, casa, deporte o mercado. Sin maquillaje.' },
  { Icon: Gauge, title: 'Límites y pausa', text: 'Presupuesto mensual, avisos de rachas y pausa de 1 a 365 días. La pausa también oculta las ofertas de la web.' },
  { Icon: Monitor, title: 'Web y app, una cuenta', text: 'Lo que guardas en la web aparece en el móvil y al revés. Exporta o borra tus datos cuando quieras.' },
];

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap grid-2">
          <div>
            <p className="overline" style={{ color: 'inherit', opacity: 0.8 }}>Cartera de boletos · Deportes y Lotería</p>
            <h1 style={{ marginTop: 12 }}>Todos tus boletos, <em>en un solo sitio</em>.</h1>
            <p className="lead">Guarda tus apuestas deportivas y tus boletos de lotería, mira cómo van en directo y conoce tu balance real. Gratis, en la web y en el móvil.</p>
            <div className="row" style={{ marginTop: 28 }}>
              <Link href="/cuenta/registro/" className="btn lime">Crear cuenta gratis</Link>
              <Link href="/loteria/" className="btn on-dark">Comprobar un boleto de lotería</Link>
            </div>
          </div>
          <div style={{ maxWidth: 380, justifySelf: 'center', width: '100%', transform: 'rotate(-2deg)' }}>
            <Receipt label="Ejemplo de tique de Gol-Wallet">
              <ReceiptHead left="Ejemplo · Deportes" right="Combinada de 3" />
              <Cut />
              <p className="overline" style={{ color: 'var(--paper-muted)' }}>Premio posible</p>
              <Marker>84,60 €</Marker>
              <div style={{ margin: '10px 0' }}><Stamp kind="live" label="En juego" /></div>
              <Leader label="Apostado" value="10,00 €" />
              <Leader label="Cuota" value="8,46" />
              <Leader label="Selecciones" value="2 de 3 ✓" />
              <Cut />
              <Barcode seed="gol-wallet-ejemplo" caption="Ejemplo ilustrativo" />
            </Receipt>
          </div>
        </div>
      </section>

      <div className="wrap">
        <section className="section stack" aria-labelledby="que-es">
          <h2 id="que-es">Lo mismo que la app, ahora también en la web</h2>
          <div className="grid-3">
            {FEATURES.map(({ Icon, title, text }) => (
              <div className="card stack-sm" key={title}>
                <Icon size={26} aria-hidden />
                <h3>{title}</h3>
                <p className="muted">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <LatestDraws />

        <section className="section grid-2" aria-labelledby="como">
          <div className="stack">
            <h2 id="como">Cómo funciona</h2>
            <ol className="stack" style={{ paddingLeft: 20, margin: 0 }}>
              <li><strong>Crea tu cuenta</strong> con tu email (la misma sirve en la app).</li>
              <li><strong>Añade tus boletos</strong>: sube la foto o apúntalos a mano eligiendo el partido.</li>
              <li><strong>Olvídate</strong>: el estado se actualiza solo y el resultado entra en tus estadísticas.</li>
            </ol>
            <div className="row"><Link href="/cuenta/registro/" className="btn">Empezar</Link><Link href="/cuenta/entrar/" className="btn ghost">Ya tengo cuenta</Link></div>
          </div>
          <div className="card tint stack-sm" id="app">
            <Smartphone size={28} aria-hidden />
            <h3>App para Android e iPhone</h3>
            <p>En el móvil además lees el boleto con la cámara y recibes avisos de goles y premios. Con la misma cuenta ves aquí lo que guardas allí.</p>
            <p className="subtle" style={{ color: 'inherit' }}>Enlaces de descarga disponibles cuando la app esté publicada en las tiendas.</p>
          </div>
        </section>

        <Offers slot="home" title="¿Buscas casa? Solo operadores con licencia en España"
          intro="Comprobamos que cada casa tenga licencia de la Dirección General de Ordenación del Juego. Compara condiciones con calma." />

        <section className="section grid-2" aria-labelledby="seguro">
          <div className="stack-sm">
            <h2 id="seguro">Un registro que te ayuda a jugar menos, no más</h2>
            <p className="muted">Gol-Wallet no es una casa de apuestas: no acepta apuestas ni dinero. Te enseña lo que de verdad llevas jugado y te avisa si las cosas se tuercen.</p>
            <ul className="stack-sm" style={{ listStyle: 'none', padding: 0 }}>
              <li className="row"><CheckCircle2 size={18} aria-hidden /> Sin ofertas dentro de tu cartera.</li>
              <li className="row"><ShieldCheck size={18} aria-hidden /> La pausa oculta también las ofertas de la web.</li>
              <li className="row"><Ticket size={18} aria-hidden /> Tus datos son tuyos: exporta o borra la cuenta en un clic.</li>
            </ul>
          </div>
          <div className="card stack-sm">
            <h3>¿Necesitas ayuda?</h3>
            <p>Si el juego te está causando problemas, llama al <strong>900 200 225</strong> (FEJAR, gratuito) o visita <a href="https://www.jugarbien.es" target="_blank" rel="noopener">jugarbien.es</a>. Puedes autoexcluirte de todas las casas en el <a href="https://www.ordenacionjuego.es/participantes-juego/registro-general-interdicciones-acceso-juego" target="_blank" rel="noopener">RGIAJ</a>.</p>
            <Link href="/juego-responsable/" className="btn ghost sm">Herramientas de juego responsable</Link>
          </div>
        </section>
      </div>
    </>
  );
}
