import type { Metadata } from 'next';
import { LegalPage } from '../../../components/LegalPage';
import { COOKIE_SECTIONS } from '../../../content/legalWeb';

export const metadata: Metadata = { title: 'Cookies' };
export default function Cookies() { return <LegalPage title="Cookies" sections={COOKIE_SECTIONS} />; }
