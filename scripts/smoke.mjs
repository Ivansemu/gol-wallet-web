// Comprobación tras desplegar: páginas que responden, cabeceras de seguridad y nada de claves privadas en el JS.
//   node scripts/smoke.mjs https://<proyecto>.pages.dev
const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!base) { console.error('Uso: node scripts/smoke.mjs <url>'); process.exit(1); }
const pages = ['/', '/loteria/', '/herramientas/', '/casas/', '/juego-responsable/', '/legal/aviso-legal/', '/legal/privacidad/', '/cuenta/entrar/', '/cartera/', '/robots.txt', '/sitemap.xml'];
let failed = 0;
const fail = (m) => { failed++; console.log(`✗ ${m}`); };
for (const p of pages) {
  const r = await fetch(base + p).catch(() => null);
  if (!r || r.status !== 200) { fail(`${p} → ${r?.status ?? 'sin respuesta'}`); continue; }
  console.log(`✓ ${p}`);
  if (p === '/') {
    for (const h of ['content-security-policy', 'x-frame-options', 'x-content-type-options', 'strict-transport-security'])
      if (!r.headers.get(h)) fail(`falta la cabecera ${h}`);
    const html = await r.text();
    const scripts = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]);
    for (const s of scripts) {
      const js = await (await fetch(base + s)).text();
      if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(js)) fail(`${s} contiene una clave secreta de Supabase`);
      for (const [jwt] of js.matchAll(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/g)) {
        const role = (() => { try { return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).role; } catch { return null; } })();
        if (role === 'service_role') fail(`${s} contiene la clave service_role`);
      }
    }
    console.log(`✓ ${scripts.length} scripts revisados: sin claves privadas`);
  }
}
const cartera = await fetch(base + '/cartera/');
if (!/noindex/.test(cartera.headers.get('x-robots-tag') ?? '')) fail('/cartera/ sin X-Robots-Tag: noindex');
if (failed) { console.error(`\n${failed} fallos`); process.exit(1); }
console.log('\nDespliegue correcto.');
