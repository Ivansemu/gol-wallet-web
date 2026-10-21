// Comprobación previa al despliegue en producción: ¿el Supabase de destino tiene lo que la web necesita?
// Solo lecturas públicas (las mismas que hace cualquier visitante). Falla si falta alguna migración de la web.
//   node scripts/check-server.mjs            (lee .env.production o las variables NEXT_PUBLIC_*)
import { readFileSync, existsSync } from 'node:fs';

const env = { ...Object.fromEntries((existsSync('.env.production') ? readFileSync('.env.production', 'utf8') : '')
  .split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => l.split(/=(.*)/s).slice(0, 2))), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL, key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY'); process.exit(1); }

const rpc = async (fn, body = {}) => {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const checks = [
  ['0032 · sorteos públicos', () => rpc('public_latest_draws'), (r) => r.status === 200 && Array.isArray(r.body)],
  ['0031 · ofertas (deben salir apagadas)', () => rpc('affiliate_offers', { p_slot: 'home' }), (r) => r.status === 200 && r.body?.enabled === false],
  ['0031 · redirección affiliate-go desplegada', async () => {
    const r = await fetch(`${url}/functions/v1/affiliate-go/comprobacion`, { redirect: 'manual' });
    return { status: r.status, body: r.headers.get('location') };
  }, (r) => r.status === 302],
];
let failed = 0;
for (const [name, run, ok] of checks) {
  const r = await run().catch((e) => ({ status: 0, body: e.message }));
  const pass = ok(r);
  if (!pass) failed++;
  console.log(`${pass ? '✓' : '✗'} ${name}${pass ? '' : ` (HTTP ${r.status}: ${JSON.stringify(r.body).slice(0, 120)})`}`);
}
if (failed) { console.error(`\n${failed} comprobaciones fallan: aplica 0026–0032 y despliega affiliate-go antes de publicar la web (winzo-backend/docs/OPERACIONES.md §1).`); process.exit(1); }
console.log('\nServidor listo para la web.');
