import type { Metadata } from 'next';
import { Tools } from './Tools';

export const metadata: Metadata = {
  title: 'Herramientas: calculadora de sistemas, conversor de cuotas y margen de la casa',
  description: 'Calcula trixie, yankee, lucky 15 y otros sistemas; convierte cuotas decimales, fraccionarias y americanas; y descubre el margen que se queda la casa.',
};

export default function Herramientas() {
  return (
    <div className="wrap">
      <div className="page-head">
        <p className="overline">Herramientas · Gratis, sin cuenta</p>
        <h1>Herramientas</h1>
        <p className="muted" style={{ maxWidth: '62ch' }}>Para entender lo que juegas, no para jugar más: cuánto cuesta de verdad un sistema, qué probabilidad hay detrás de una cuota y cuánto margen se queda la casa.</p>
      </div>
      <Tools />
    </div>
  );
}
