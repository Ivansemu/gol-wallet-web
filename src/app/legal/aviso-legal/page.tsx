import type { Metadata } from 'next';
import { LegalPage } from '../../../components/LegalPage';
import { legalUpdated, webTerms } from '../../../content/legalWeb';
import { LEGAL } from '../../../shared/lib/legal';

export const metadata: Metadata = { title: 'Aviso legal y condiciones' };

export default function AvisoLegal() {
  const o = LEGAL.owner;
  return <LegalPage title="Aviso legal y condiciones" updated={legalUpdated} sections={[
    { title: 'Titular', paragraphs: [`${o.name}, NIF ${o.nif}, ${o.address}. Contacto: ${o.email}.`] },
    ...webTerms(),
  ]} />;
}
