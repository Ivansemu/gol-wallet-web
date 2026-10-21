# Gol-Wallet · web

Versión web de Gol-Wallet: la misma cuenta, los mismos boletos y las mismas cuentas que la app, más páginas públicas
(comprobar lotería, herramientas, casas con licencia, juego responsable) donde pueden aparecer **enlaces de afiliación**.
La app de las tiendas no muestra ofertas, y la cartera privada de la web tampoco.

Next.js (App Router) con exportación estática (`out/`): sin servidor propio. Todo lo dinámico va al mismo proyecto de Supabase
que la app, con RLS. Diseño «Recibo» con los tokens de la app.

## Estructura

| Ruta | Qué es |
|---|---|
| `src/app/` | Páginas. Públicas: `/`, `/loteria`, `/herramientas`, `/casas`, `/juego-responsable`, `/legal/*`. Cuenta: `/cuenta/*`. Privadas: `/cartera/*` (inicio, historial, boleto, añadir, estadísticas, perfil) |
| `src/shared/` | **Copia** de `winzo-app/src/lib`, `src/types`, `src/utils` y los tokens. No se edita aquí: se cambia la app y se ejecuta `npm run sync` |
| `src/styles/tokens.css` | Variables CSS **generadas** desde `winzo-app/src/theme/tokens.ts` (sin hex sueltos) |
| `src/lib/api.ts` | Llamadas a Supabase, al lector OCR y a `affiliate-go` |
| `src/lib/wallet.ts` | Boletos del servidor ↔ formato de la app (lógica pura, con pruebas) |
| `src/components/Offers.tsx` | Ofertas: interruptor del servidor, aviso +18, licencia, aviso de afiliación y clic vía `affiliate-go` |
| `src/content/legalWeb.ts` | Textos legales de la app + los propios de la web (afiliación, clics, almacenamiento local) |

## Afiliados: reglas que impone el código

- Todo está **apagado** hasta que alguien con `settings.write` enciende `app_settings.affiliates` en el backoffice, indicando el motivo.
- Solo operadores con **licencia DGOJ**: la base de datos no deja activar una casa sin ella, y cada oferta muestra la licencia.
- Solo en páginas públicas (ubicaciones `home`, `compare` y `lottery`). Nunca en `/cartera` ni después de guardar un boleto.
- Solo a quien confirma tener 18 años o más. Nunca a usuarios con **pausa** activa, con «no ver ofertas» o con la cuenta suspendida.
  El servidor lo comprueba en `affiliate_offers` y otra vez en `affiliate-go`.
- El enlace de destino solo lo conoce el servidor. Cada clic se registra sin la IP (se guarda un hash con sal) y se conserva 13 meses.
- Cada bloque de ofertas lleva al lado el texto de aviso («Enlace de afiliado…») y hay una página «Cómo nos financiamos».
- **Pendiente antes de encenderlo:** revisión legal según el RD 958/2020 (textos, ubicaciones y horarios si aplica), contratos con
  los operadores, enlaces reales y comprobar el teléfono de ayuda que se muestra (FEJAR 900 200 225).

## Desarrollo

```bash
npm ci
cp .env.example .env.local     # rellenar NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev                    # http://localhost:3000 (antes sincroniza src/shared si existe ../winzo-app)
```

`npm run sync` copia la lógica desde `../winzo-app` (o desde `WINZO_APP_DIR`). Si la app no está al lado (CI, Cloudflare),
se usa la copia versionada en `src/shared`. `node scripts/sync-shared.mjs --check` falla si la copia no coincide con la app.

## Pruebas

```bash
npm run typecheck
npm test                            # lógica de la cartera y textos legales (node:test)
npm run build:demo && npm run e2e   # 9 recorridos en Chromium contra un Supabase simulado; capturas en tests/shots/
```

El e2e usa un Supabase **simulado** (`tests/fake-supabase.mjs`) para comprobar el cableado de la web: qué muestra y qué envía.
La lógica SQL real (RLS, afiliados, pausa, sorteos públicos) se prueba en `winzo-backend/tests/db` con las migraciones de verdad.

## Despliegue (Cloudflare Pages)

Todo está preparado en el repositorio; **no se ha desplegado nada**. Lo hace GitHub Actions (`.github/workflows/web.yml`):

| Cuándo | Qué hace |
|---|---|
| Cada push y PR | typecheck, pruebas, build y los 9 recorridos en Chromium |
| Push a una rama que no es `main` | preview en `https://<rama>.gol-wallet-web.pages.dev` (si hay credenciales) |
| A mano: Actions → «Gol-Wallet web» → Run workflow en `main`, escribiendo `produccion` | comprueba el servidor, despliega en producción y hace la comprobación posterior |

Valores públicos de producción en `.env.production` (URL de Supabase y clave **publicable**; nunca la service role).
`scripts/headers.mjs` genera `out/_headers` (CSP con esas mismas URL, `noindex` y sin caché en `/cartera` y `/cuenta`,
caché larga en `/_next/static`). `npm run preview:cf` sirve `out/` con el servidor de Cloudflare para probarlo en local.

### Lo que tienes que hacer tú (una vez)

1. **Cloudflare** → Account API tokens → Create token → permiso *Account · Cloudflare Pages · Edit*.
2. **GitHub** → este repositorio → Settings → Secrets and variables → Actions: `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
3. **GitHub** → Settings → Environments → `production` → *Required reviewers*: tú. Así nadie publica sin tu aprobación.
4. **Servidor antes de producción** (en este orden, ver `winzo-backend/docs/OPERACIONES.md §1`): copia de seguridad,
   migraciones 0026–0032 (la 0025b ya está en producción), Edge Function `affiliate-go` con `AFFILIATE_IP_SALT` y `WEB_ORIGIN`,
   y `WEB_ORIGINS` en el worker OCR. Hasta entonces el paso «El servidor tiene lo que la web necesita» para el despliegue.
5. **Dominio**: en Cloudflare Pages → gol-wallet-web → Custom domains → `gol-wallet.com`. En Supabase → Auth →
   URL Configuration → Redirect URLs: `https://gol-wallet.com/cartera/` y `https://gol-wallet.com/cuenta/nueva-clave/`.
   Mientras no haya dominio, la comprobación posterior usa `https://gol-wallet-web.pages.dev`.

El primer despliegue crea el proyecto `gol-wallet-web` en Cloudflare si no existe. Las previews usan la base de datos
de producción (no hay otra): se pueden crear cuentas y boletos reales desde ellas.

## Limitaciones conocidas

- Los boletos de lotería guardados en la app solo existen en el móvil: la web comprueba lotería sin cuenta, pero no los lista.
- La pausa de la web (en el servidor) y la de la app (local) todavía no se sincronizan.
- Tiempo real: si el canal no conecta, la cartera se refresca cada 2 minutos.
- El presupuesto mensual y los límites locales de la app no están en la web.
