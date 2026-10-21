// Cliente de Supabase del navegador: el MISMO proyecto que la app (cuentas, boletos y sorteos compartidos).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const OCR_URL = process.env.NEXT_PUBLIC_OCR_WORKER_URL ?? 'https://winzo-ocr-worker.winzo-ocr-2025.workers.dev';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://gol-wallet.com';

let client: SupabaseClient | null = null;

/** null si la web se compiló sin configurar Supabase (se avisa en pantalla, no se inventa nada). */
export function supabase(): SupabaseClient | null {
  if (typeof window === 'undefined' || !SUPABASE_URL || !ANON) return null;
  client ??= createClient(SUPABASE_URL, ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'golwallet-web-auth' },
  });
  return client;
}

export const backendConfigured = () => !!SUPABASE_URL && !!ANON;
