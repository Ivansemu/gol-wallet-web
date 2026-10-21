// Genera out/_headers (Cloudflare Pages) tras el build: cabeceras de seguridad y caché.
// La política de contenido (CSP) se arma con las mismas variables del build, así no se desincroniza.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'out');
if (!existsSync(out)) { console.error('headers: falta out/ (ejecuta next build antes)'); process.exit(1); }

// Mismas variables que usó next build: las del entorno y, si faltan, las de .env.production
const fileEnv = existsSync(join(root, '.env.production')) ? Object.fromEntries(readFileSync(join(root, '.env.production'), 'utf8')
  .split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => l.split(/=(.*)/s).slice(0, 2))) : {};
const env = (k) => process.env[k] ?? fileEnv[k] ?? '';
const origin = (u) => { try { return new URL(u).origin; } catch { return ''; } };
const supa = origin(env('NEXT_PUBLIC_SUPABASE_URL'));
const ocr = origin(env('NEXT_PUBLIC_OCR_WORKER_URL'));
const connect = ["'self'", supa, supa && supa.replace(/^https:/, 'wss:'), ocr].filter(Boolean).join(' ');

// Next (exportación estática) mete scripts y estilos en línea: 'unsafe-inline' es necesario sin un servidor que ponga nonces.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${connect}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const text = `/*
  Content-Security-Policy: ${csp}
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains

/_next/static/*
  Cache-Control: public, max-age=31536000, immutable

/cartera/*
  X-Robots-Tag: noindex
  Cache-Control: no-store

/cuenta/*
  X-Robots-Tag: noindex
`;
writeFileSync(join(out, '_headers'), text);
console.log(`headers: out/_headers (connect-src ${connect})`);
