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

No está desplegada. Pasos, cuando haya autorización:

1. Aplicar `0031_affiliates.sql` y `0032_web_public.sql` y desplegar `affiliate-go` (ver `winzo-backend/docs/OPERACIONES.md §1`).
2. En Pages, conectar este repositorio. Build: `npm ci && npm run build`. Directorio de salida: `out`.
3. Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_OCR_WORKER_URL`, `NEXT_PUBLIC_SITE_URL`.
4. En Supabase → Auth → Redirect URLs: `https://<dominio>/cartera/` y `https://<dominio>/cuenta/nueva-clave/`.
5. Worker OCR: añadir el dominio de la web a `WEB_ORIGINS`. En `affiliate-go`: `WEB_ORIGIN` con el mismo dominio.

Se da por hecho el dominio `gol-wallet.com` (el del email legal). Si es otro, hay que cambiarlo en todos esos sitios.

## Limitaciones conocidas

- Los boletos de lotería guardados en la app solo existen en el móvil: la web comprueba lotería sin cuenta, pero no los lista.
- La pausa de la web (en el servidor) y la de la app (local) todavía no se sincronizan.
- Tiempo real: si el canal no conecta, la cartera se refresca cada 2 minutos.
- El presupuesto mensual y los límites locales de la app no están en la web.
