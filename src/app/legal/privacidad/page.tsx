import type { Metadata } from 'next';
import { LegalPage } from '../../../components/LegalPage';
import { legalUpdated, webPrivacy } from '../../../content/legalWeb';

export const metadata: Metadata = { title: 'Política de privacidad' };
export default function Privacidad() { return <LegalPage title="Política de privacidad" updated={legalUpdated} sections={webPrivacy()} />; }
