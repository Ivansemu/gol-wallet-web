import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/supabase';

export const dynamic = 'force-static';
const PAGES = ['', 'loteria/', 'herramientas/', 'casas/', 'juego-responsable/', 'legal/aviso-legal/', 'legal/privacidad/', 'legal/cookies/', 'legal/afiliacion/'];
export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(p => ({ url: `${SITE_URL}/${p}`, changeFrequency: p === 'loteria/' ? 'daily' : 'monthly' }));
}
