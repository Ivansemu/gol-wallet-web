// Prueba de la web compilada (out/) en Chromium contra un Supabase simulado (tests/fake-supabase.mjs).
// Compilar antes con las variables de demo (ver README · «Pruebas»). Guarda capturas en tests/shots/.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { install, seed } from './fake-supabase.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4173';
const SHOTS = join(here, 'shots');
let server, browser;

before(async () => {
  mkdirSync(SHOTS, { recursive: true });
  server = spawn('python3', ['-m', 'http.server', '4173', '-d', join(here, '..', 'out')], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
});
after(async () => { await browser?.close(); server?.kill(); });

async function open(path, { signedIn = false, mobile = false, db = seed() } = {}) {
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-ES', timezoneId: 'Europe/Madrid' }
    : { viewport: { width: 1280, height: 860 }, locale: 'es-ES', timezoneId: 'Europe/Madrid' });
  await install(ctx, db, { signedIn });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  return { page, ctx, db, errors };
}
const shot = (page, name, full = true) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: full });

test('portada: sin ofertas hasta confirmar la edad; luego con licencia y aviso de afiliación', async () => {
  const { page, ctx, db, errors } = await open('/');
  await page.getByText('Todos tus boletos,').waitFor();
  assert.equal(await page.getByText('Casa Norte (ejemplo)').count(), 0, 'sin confirmar +18 no hay ofertas');
  await page.getByText('Últimos sorteos').waitFor();
  await shot(page, '01-portada');
  await page.getByRole('button', { name: 'Tengo 18 años o más' }).click();
  await page.getByRole('heading', { name: 'Casa Norte (ejemplo)' }).waitFor();
  assert.ok(await page.getByText('Licencia general GA/0000/000 (ejemplo)').isVisible());
  assert.ok(await page.getByText(/Enlace de afiliado/).first().isVisible());
  await page.getByRole('heading', { name: 'Casa Norte (ejemplo)' }).scrollIntoViewIfNeeded();
  await shot(page, '02-portada-ofertas', false);
  await page.getByRole('button', { name: /Ir a Casa Norte/ }).click();
  await page.waitForURL(/demo\.supabase\.co\/functions\/v1\/affiliate-go\/casa-norte/);
  assert.equal(db.sent.go[0].method, 'GET', 'sin sesión: redirección directa');
  assert.match(db.sent.go[0].url, /affiliate-go\/casa-norte\?slot=home&from=%2F/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('menor de edad: no vuelve a ver ofertas', async () => {
  const { page, ctx } = await open('/casas/');
  await page.getByRole('button', { name: 'Soy menor' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.getByText('Casa Norte (ejemplo)').count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Tengo 18 años o más' }).count(), 0);
  await ctx.close();
});

test('entrar y cartera con el estado del servidor', async () => {
  const { page, ctx, errors } = await open('/cartera/');
  await page.waitForURL(/\/cuenta\/entrar\/\?next=/);
  await shot(page, '03-entrar', false);
  await page.getByLabel('Email').fill('lucia@ejemplo.es');
  await page.getByLabel('Contraseña').fill('contraseña-demo1');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(`${BASE}/cartera/`);
  await page.getByText('Resumen · Deportes').waitFor();
  assert.ok(await page.getByText('Combinada de 2').first().isVisible());
  // Ganado 18,60 − 10 + perdido −5 + cobrado 12 − 8 = +7,60 €
  assert.ok(await page.getByText('+7,60 €').first().isVisible(), 'balance con la lógica de la app');
  assert.equal(await page.getByText(/Casa Norte \(ejemplo\)/).count(), 0, 'nunca ofertas en la cartera');
  await shot(page, '04-cartera');
  await page.getByText('Combinada de 2').first().click();
  await page.getByText('Selecciones', { exact: true }).waitFor();
  assert.ok(await page.getByText('2-1').first().isVisible(), 'marcador en directo');
  await shot(page, '05-boleto');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('añadir a mano con partido del backoffice: entra emparejada y llega como boleto de la app', async () => {
  const { page, ctx, db } = await open('/cartera/nuevo/', { signedIn: true });
  await page.getByRole('button', { name: /A mano/ }).click();
  await page.getByLabel('Casa de apuestas').fill('Casa Norte');
  await page.getByLabel('Importe apostado').fill('10');
  await page.getByLabel('Busca el partido').fill('betis sevilla');
  await page.getByRole('button', { name: /Real Betis - Sevilla FC/ }).click();
  await page.getByRole('button', { name: 'Real Betis', exact: true }).click();
  await page.getByLabel('Cuota').fill('2,10');
  await page.getByText('se resolverá sola').waitFor();
  await shot(page, '06-nuevo-a-mano');
  await page.getByRole('button', { name: 'Guardar boleto' }).click();
  await page.waitForURL(/\/cartera\/boleto\/\?id=r-new-1/);
  const slip = db.sent.slips[0];
  assert.equal(slip.stake, 10);
  assert.equal(slip.raw.app, 'gol-wallet-web');
  assert.equal(slip.raw.events[0].fixtureId, 'fx-1');
  assert.equal(db.sent.selections[0].status, 'pending', 'emparejada: el servidor la evalúa');
  assert.equal(db.sent.selections[0].market_key, 'match_result');
  assert.deepEqual(db.sent.selections[0].params, { pick: 'home', index: 0 });
  await ctx.close();
});

test('añadir con foto: se revisa antes de guardar', async () => {
  const { page, ctx, db } = await open('/cartera/nuevo/', { signedIn: true, mobile: true });
  await page.locator('input[type=file]').setInputFiles(join(here, '..', 'public', 'icon.png'));
  await page.getByText('Leído de la foto').waitFor();
  assert.equal(await page.getByLabel('Importe apostado').inputValue(), '5');
  await shot(page, '07-nuevo-foto-movil');
  await page.getByRole('button', { name: 'Guardar boleto' }).click();
  await page.waitForURL(/boleto/);
  assert.equal(db.sent.slips[0].entry, 'scan');
  assert.equal(db.sent.slips[0].raw.ticketId, 'CN-7781');
  await ctx.close();
});

test('pausa: bloquea añadir y oculta ofertas', async () => {
  const db = seed();
  const { page, ctx } = await open('/cartera/perfil/', { signedIn: true, db });
  await page.getByText('Tu plan').waitFor();
  await shot(page, '08-perfil');
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: 'Activar pausa' }).click();
  await page.getByText('Pausa activada.').waitFor();
  assert.equal(db.sent.rpc.find(r => r.fn === 'my_safety_set').body.p_pause_days, 7);
  await page.goto(`${BASE}/cartera/nuevo/`, { waitUntil: 'networkidle' });
  await page.getByText(/Mientras tanto no se pueden añadir boletos/).waitFor();
  await page.goto(`${BASE}/casas/`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('button', { name: 'Tengo 18 años o más' }).count(), 0, 'en pausa no hay ni puerta de edad');
  await ctx.close();
});

test('con sesión, el clic de afiliado va por POST con el token', async () => {
  const { page, ctx, db } = await open('/casas/', { signedIn: true });
  await page.getByRole('button', { name: 'Tengo 18 años o más' }).click();
  await shot(page, '09-casas');
  await page.getByRole('button', { name: /Ir a Apuestas Sur/ }).click();
  await page.waitForURL('https://operador.example/alta');
  assert.equal(db.sent.go[0].method, 'POST');
  assert.equal(db.sent.go[0].auth, 'Bearer demo-token');
  await ctx.close();
});

test('comprobar lotería sin cuenta', async () => {
  const { page, ctx } = await open('/loteria/', { mobile: true });
  await page.getByRole('listitem').filter({ hasText: 'La Primitiva' }).click();
  for (const n of [4, 11, 19, 23, 1, 2]) await page.getByRole('group', { name: 'Números' }).getByRole('button', { name: String(n), exact: true }).click();
  await page.getByRole('group', { name: 'Reintegro' }).getByRole('button', { name: '3', exact: true }).click();
  await page.getByRole('button', { name: 'Comprobar' }).click();
  await page.getByText('Premiado').waitFor();
  assert.ok(await page.getByText('72,15 €').isVisible(), 'importe oficial de la categoría');
  await shot(page, '10-loteria-movil');
  await ctx.close();
});

test('herramientas y páginas legales', async () => {
  const { page, ctx, errors } = await open('/herramientas/');
  await page.getByText('Coste total').waitFor();
  await shot(page, '11-herramientas');
  await page.goto(`${BASE}/legal/aviso-legal/`, { waitUntil: 'networkidle' });
  assert.ok(await page.getByText(/enlaces de afiliación a operadores con licencia/).first().isVisible());
  await page.goto(`${BASE}/juego-responsable/`, { waitUntil: 'networkidle' });
  await shot(page, '12-juego-responsable');
  assert.deepEqual(errors, []);
  await ctx.close();
});
