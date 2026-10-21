// Copia la lógica pura de la app (winzo-app/src/lib, src/types, src/utils y los tokens de diseño) a src/shared/.
// La app es la fuente de verdad: aquí NO se edita nada de src/shared (se sobrescribe en cada build).
// Si no está la app al lado (CI, Cloudflare Pages), se usa la copia ya versionada.
//   node scripts/sync-shared.mjs           → copia
//   node scripts/sync-shared.mjs --check   → falla si la copia no coincide con la app
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = process.env.WINZO_APP_DIR ?? join(root, '..', 'winzo-app');
const out = join(root, 'src', 'shared');
const check = process.argv.includes('--check');

// Lo que importa React Native o Expo no se puede usar en la web
const SKIP = new Set(['imagePreprocessor.ts', 'statisticsExport.ts']);
const HEADER = '// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.\n';

if (!existsSync(join(app, 'src', 'lib'))) {
  if (!existsSync(out)) { console.error(`No encuentro la app en ${app} ni hay copia en src/shared`); process.exit(1); }
  console.log('sync-shared: sin winzo-app al lado, se usa la copia versionada de src/shared');
  process.exit(0);
}

const files = [];
for (const dir of ['lib', 'types', 'utils']) {
  for (const f of readdirSync(join(app, 'src', dir))) {
    if (SKIP.has(f) || !/\.(ts|json)$/.test(f)) continue;
    let text = readFileSync(join(app, 'src', dir, f), 'utf8');
    if (f.endsWith('.ts')) text = HEADER + text;
    files.push([join(dir, f), text]);
  }
}
// Tokens: lo único de React Native que usan es Platform.select para las sombras
const tokens = readFileSync(join(app, 'src', 'theme', 'tokens.ts'), 'utf8')
  .replace("import { Platform } from 'react-native';", "const Platform = { select: <T,>(o: { web?: T; default?: T; ios?: T; android?: T }): T | undefined => o.web ?? o.default ?? o.ios };");
files.push([join('theme', 'tokens.ts'), HEADER + tokens]);

let diff = 0;
for (const [rel, text] of files) {
  const dest = join(out, rel);
  const same = existsSync(dest) && readFileSync(dest, 'utf8') === text;
  if (check) { if (!same) { console.log(`distinto: src/shared/${rel}`); diff++; } continue; }
  if (!same) { mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, text); }
}
// Archivos que ya no existen en la app
for (const dir of ['lib', 'types', 'utils']) {
  const d = join(out, dir);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d)) if (!files.some(([rel]) => rel === join(dir, f))) {
    if (check) { console.log(`sobra: src/shared/${dir}/${f}`); diff++; } else rmSync(join(d, f));
  }
}
if (check) { console.log(diff ? `${diff} diferencias con la app` : 'src/shared al día con la app'); process.exit(diff ? 1 : 0); }
console.log(`sync-shared: ${files.length} archivos de ${app}`);

// Variables CSS de la web a partir de los MISMOS tokens de la app (colores, radios, espaciados).
const t = await import(join(out, 'theme', 'tokens.ts'));
const kebab = (k) => k.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
const vars = (pal) => {
  const lines = [];
  for (const [k, v] of Object.entries(pal)) {
    if (typeof v === 'string') lines.push(`--${kebab(k)}: ${v};`);
  }
  for (const [k, tone] of Object.entries(pal.status)) for (const [p, v] of Object.entries(tone)) lines.push(`--st-${k}-${p}: ${v};`);
  return lines.join(' ');
};
const css = [
  '/* GENERADO por scripts/sync-shared.mjs desde winzo-app/src/theme/tokens.ts. No editar. */',
  `:root { ${Object.entries(t.paper).map(([k, v]) => `--paper-${kebab(k)}: ${v};`).join(' ')}`,
  `  ${Object.entries(t.radius).map(([k, v]) => `--r-${k}: ${v}px;`).join(' ')}`,
  `  ${Object.entries(t.space).map(([k, v]) => `--s-${k}: ${v}px;`).join(' ')}`,
  `  ${Object.entries(t.lotteryGameColors).map(([k, v]) => `--game-${kebab(k)}: ${v};`).join(' ')}`,
  `  --star-bg: ${t.lotteryStar.bg}; --star-fg: ${t.lotteryStar.fg}; --star-border: ${t.lotteryStar.border};`,
  `  --night: ${t.stadium.night}; --dock: ${t.stadium.dock};`,
  `  ${t.chartSeries.light.map((c, i) => `--chart-${i + 1}: ${c};`).join(' ')} }`,
  `[data-section="sport"] { ${vars(t.palettesByScheme.sport.light)} }`,
  `[data-section="lottery"] { ${vars(t.palettesByScheme.lottery.light)} }`,
  `.paper[data-section], [data-section] .paper { ${vars(t.paperPalettes.sport)} }`,
  `[data-section="lottery"] .paper { ${vars(t.paperPalettes.lottery)} }`,
  `[data-scheme="dark"] [data-section="sport"], [data-scheme="dark"][data-section="sport"] { ${vars(t.palettesByScheme.sport.dark)} }`,
  `[data-scheme="dark"] [data-section="lottery"], [data-scheme="dark"][data-section="lottery"] { ${vars(t.palettesByScheme.lottery.dark)} }`,
  `[data-scheme="dark"] .paper { ${vars(t.paperPalettes.sport)} }`,
  `[data-scheme="dark"] [data-section="lottery"] .paper { ${vars(t.paperPalettes.lottery)} }`,
  '',
].join('\n');
const cssPath = join(root, 'src', 'styles', 'tokens.css');
mkdirSync(dirname(cssPath), { recursive: true });
if (!existsSync(cssPath) || readFileSync(cssPath, 'utf8') !== css) writeFileSync(cssPath, css);
