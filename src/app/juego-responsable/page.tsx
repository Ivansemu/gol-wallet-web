import type { Metadata } from 'next';
import Link from 'next/link';
import { Gauge, HeartHandshake, PauseCircle, Phone, ShieldCheck, TrendingDown } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Juego responsable',
  description: 'Herramientas de Gol-Wallet para controlar lo que juegas (presupuesto, pausa, avisos de rachas) y dónde pedir ayuda.',
};

const SIGNS = [
  'Apuestas más dinero o más a menudo para sentir lo mismo.',
  'Intentas recuperar lo perdido con otra apuesta.',
  'Mientes sobre lo que juegas o lo escondes.',
  'Pides dinero prestado o dejas de pagar cosas para jugar.',
  'Te pones nervioso o de mal humor cuando no puedes apostar.',
];

export default function JuegoResponsable() {
  return (
    <div className="narrow">
      <div className="page-head">
        <p className="overline">Juego responsable</p>
        <h1>Jugar con cabeza</h1>
        <p className="muted">Apostar debe ser un entretenimiento con un gasto que puedas permitirte. Gol-Wallet te ayuda a verlo claro con datos reales.</p>
      </div>
      <div className="stack">
        <div className="card stack-sm"><h2 className="row" style={{ fontSize: 20 }}><Gauge size={20} aria-hidden /> Presupuesto y avisos</h2>
          <p>En la app fijas un presupuesto mensual y te avisamos al acercarte. También te avisamos de rachas de pérdidas y de cuando apuestas más para recuperar.</p></div>
        <div className="card stack-sm"><h2 className="row" style={{ fontSize: 20 }}><PauseCircle size={20} aria-hidden /> Pausa</h2>
          <p>Desde tu <Link href="/cartera/perfil/">perfil</Link> puedes pausar de 1 a 365 días. Durante la pausa no puedes añadir boletos y no verás ninguna oferta de casas en la web. No se puede acortar.</p></div>
        <div className="card stack-sm"><h2 className="row" style={{ fontSize: 20 }}><ShieldCheck size={20} aria-hidden /> Sin ofertas en tu cartera</h2>
          <p>Tu cartera, tu historial y tus estadísticas nunca muestran publicidad. Las ofertas de la web solo aparecen en páginas públicas, a mayores de 18 años, y puedes ocultarlas siempre.</p></div>
        <div className="card stack-sm"><h2 className="row" style={{ fontSize: 20 }}><TrendingDown size={20} aria-hidden /> Señales de alarma</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }} className="stack-sm">{SIGNS.map(s => <li key={s}>{s}</li>)}</ul></div>
        <div className="card tint stack-sm"><h2 className="row" style={{ fontSize: 20 }}><Phone size={20} aria-hidden /> Pide ayuda</h2>
          <p><b>FEJAR</b> (Federación Española de Jugadores de Azar Rehabilitados): <b>900 200 225</b>, gratuito.</p>
          <p><a href="https://www.jugarbien.es" target="_blank" rel="noopener">jugarbien.es</a>, de la Dirección General de Ordenación del Juego.</p>
          <p>Autoprohibición en todas las casas con licencia: <a href="https://www.ordenacionjuego.es/participantes-juego/registro-general-interdicciones-acceso-juego" target="_blank" rel="noopener">RGIAJ</a>.</p></div>
        <p className="subtle row"><HeartHandshake size={16} aria-hidden /> El juego está prohibido a menores de 18 años.</p>
      </div>
    </div>
  );
}
