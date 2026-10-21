import type { Metadata } from 'next';
import { LegalPage } from '../../../components/LegalPage';
import { AFFILIATE_SECTIONS } from '../../../content/legalWeb';

export const metadata: Metadata = { title: 'Cómo nos financiamos' };
export default function Afiliacion() { return <LegalPage title="Cómo nos financiamos" sections={AFFILIATE_SECTIONS} />; }
