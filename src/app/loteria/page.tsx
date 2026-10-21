import type { Metadata } from 'next';
import { Checker } from './Checker';
import { Offers } from '../../components/Offers';

export const metadata: Metadata = {
  title: 'Comprobar lotería: Euromillones, Primitiva, Bonoloto, El Gordo y más',
  description: 'Comprueba gratis tu boleto de Euromillones, La Primitiva, Bonoloto, El Gordo, EuroDreams, Lotería Nacional, ONCE y Quiniela con los resultados oficiales.',
};

export default function Loteria() {
  return (
    <div data-section="lottery" style={{ background: 'var(--bg)' }}>
      <div className="wrap">
        <div className="page-head">
          <p className="overline">Lotería · Resultados oficiales</p>
          <h1>Comprobar mi boleto</h1>
          <p className="muted" style={{ maxWidth: '62ch' }}>Elige el juego, la fecha del sorteo y tus números. Te decimos la categoría de premio con los aciertos y el importe oficial cuando ya está publicado. No hace falta cuenta.</p>
        </div>
        <Checker />
        <Offers slot="lottery" title="Juega online solo con operadores autorizados"
          intro="Los juegos de SELAE y la ONCE también se venden en puntos de venta oficiales. Si juegas online, hazlo solo con operadores con licencia." />
      </div>
    </div>
  );
}
