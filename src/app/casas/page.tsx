import type { Metadata } from 'next';
import { BadgeCheck, Ban, FileSearch, Scale, ShieldAlert } from 'lucide-react';
import { Offers } from '../../components/Offers';

export const metadata: Metadata = {
  title: 'Casas de apuestas con licencia en España (DGOJ)',
  description: 'Cómo saber si una casa de apuestas tiene licencia en España, qué mirar en sus condiciones y casas con licencia de la DGOJ.',
};

const CHECKS = [
  { Icon: BadgeCheck, title: 'Licencia de la DGOJ', text: 'Toda casa que opere en España debe tener licencia de la Dirección General de Ordenación del Juego y mostrar su sello «Juego seguro». Compruébalo en ordenacionjuego.es.' },
  { Icon: FileSearch, title: 'Lee las condiciones', text: 'Antes de aceptar una promoción mira el rollover (cuántas veces hay que apostar el bono), la cuota mínima, el plazo y los mercados excluidos.' },
  { Icon: Scale, title: 'Compara cuotas y margen', text: 'Una diferencia pequeña de cuota pesa mucho a la larga. Con nuestra herramienta de margen ves cuánto se queda la casa en cada mercado.' },
  { Icon: Ban, title: 'Límites y autoexclusión', text: 'Las casas con licencia deben dejarte fijar límites de depósito y autoexcluirte. Úsalos. El RGIAJ te excluye de todas a la vez.' },
];

export default function Casas() {
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="overline">Casas con licencia · +18</p>
        <h1>Casas de apuestas con licencia en España</h1>
        <p className="muted" style={{ maxWidth: '64ch' }}>Gol-Wallet no es una casa de apuestas. Aquí te explicamos cómo elegir con seguridad y, si quieres, te enseñamos operadores con licencia de la DGOJ con los que tenemos acuerdo de afiliación.</p>
      </div>
      <section className="grid-2" aria-label="Qué mirar">
        {CHECKS.map(({ Icon, title, text }) => (
          <div key={title} className="card stack-sm"><Icon size={24} aria-hidden /><h2 style={{ fontSize: 19 }}>{title}</h2><p className="muted">{text}</p></div>
        ))}
      </section>
      <Offers slot="compare" title="Operadores con licencia" intro="Orden por acuerdo comercial y revisión manual de la licencia, no por lo que más paga. Ninguna casa paga por aparecer más arriba sin que lo indiquemos." />
      <section className="section">
        <div className="notice"><ShieldAlert size={18} aria-hidden /> Si apostar ha dejado de ser un entretenimiento, para. Llama gratis al 900 200 225 (FEJAR) o visita jugarbien.es. No uses ninguna oferta para recuperar pérdidas.</div>
      </section>
    </div>
  );
}
