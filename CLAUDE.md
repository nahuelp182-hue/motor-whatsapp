@AGENTS.md

# motor-whatsapp

Plataforma interna de Micelium Argentina sobre Next.js 16 (App Router) + Prisma + Postgres
(Supabase), desplegada en Vercel como `mw-micelium`. **No es un SaaS vendible**: el esquema
es multi-tenant (`Store`, `store_id`) pero el runtime atiende una sola tienda. Ver
`PLAN_ARQUITECTURA.md` para el estado y el plan de correcciones.

Conviven ~7 productos: bot de WhatsApp, portal de guías (`guias.infomicelium.com.ar`),
motor de widgets, tracking de curiosos, radar, calendario y atribución de ads.

---

## Trampas verificadas (27/07/2026)

Cada una tiene fecha de caducidad: cuando el bloque que la resuelve esté hecho, se borra
de acá. Una trampa vencida es peor que ninguna.

**Base de datos — hay dos caminos y no son el mismo.**
El runtime conecta con `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD` (pooler de Supabase);
las migraciones con `DATABASE_URL` (`prisma.config.ts`). El `datasource` del schema ni
declara `url`. De ahí sale el folklore "Prisma con `DATABASE_URL` no conecta en runtime"
documentado en `lib/ratelimit.ts` y `lib/diag.ts`. *(Se cierra en el bloque C.)*

**Cinco tablas viven solo en producción, fuera de `schema.prisma`:**
`ig_diag`, `wa_procesado`, `claude_usage`, `radar_snapshot`, `radar_youtube`. Se crearon a
mano con `scripts/aplicar-sql.js` y con los `ensureTabla()` de `lib/radar.ts`. Un clon
limpio compila y falla en runtime. Adoptarlas requiere `prisma db pull` contra la base real
—escribir los modelos a mano es adivinar tipos, y un modelo equivocado hace que Prisma
genere migraciones para "corregir" una tabla que está bien. *(Se cierra en el bloque C.)*

**El pool de Postgres vive en `lib/db.ts`, y es uno solo.** Había seis `new pg.Pool`
repartidos (dos en `lib/`, cuatro copiados dentro de rutas), cada uno abriendo su propia
conexión contra el pooler. **No crear pools nuevos**: importar `getPool` de `@/lib/db`.
El único que sigue aparte es el de `lib/prisma.ts`, por un motivo explicado ahí.

**`ig_diag` no es un log: es la base operativa del bot.** Historial de conversación, dedupe
de webhooks, handoff lock y debounce de ráfagas salen de ahí con `detail->>'campo'`, sin
índice y sin retención. Antes de tocar el bot, leer `lib/diag.ts` entero.
*(Se cierra en el bloque F.)*

**`error_details` todavía carga DOS significados.** Era la columna de errores, la marca de
idempotencia (`order:<id>`, que `CampaignService` consulta con `contains`) y el payload de
la cola. El payload ya salió a su propia columna (`payload`, migración
`20260727150000_cola_envios`), pero la marca sigue ahí: **antes de tocar `error_details`,
mirar si esa fila la usa como marca**. La cola vive en `lib/cola-envios.ts`, no en la ruta
del cron.

**Ningún cron corre en Vercel — `vercel.json` tiene `"crons": []` a propósito.** El plan es
**Hobby**: tope de 2 crons, solo diarios. El 31/07/2026 había SEIS declarados, o sea que
cuatro nunca corrieron; y no se detectó porque el único que podía avisarlo (`resumen-bot`)
era uno de los que no corría. `CronHeartbeat` estaba vacía desde el día uno.

Dónde vive cada cosa ahora, y la regla para decidirlo:

- **GitHub Actions** → todo lo que VIGILA al sistema: `despacho-watchdog.yml`,
  `resumen-bot.yml`. Un vigilante no puede vivir en la infraestructura que vigila. GH es
  una tercera infra, independiente de Hetzner y de Vercel.
- **Cron del VPS** (`curl` con `CRON_SECRET`) → el trabajo de negocio: `carrito-abandonado`,
  `resena-post-entrega`, `send-pending`, `radar`, `sync-calendario`, `ciclo-cultivo`.
- **Vercel** → nada. Si alguien vuelve a agregar un cron acá, con el plan Hobby entra en la
  ruleta de cuáles dos sobreviven.

Al agregar un cron nuevo: elegí GH Actions o VPS según la regla de arriba, y hacelo llamar a
`marcarHeartbeat()` o no vas a enterarte cuando muera.

**Los previews SÍ escriben en la base de producción — confirmado, no es un supuesto.**
`vercel env ls` muestra `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DATABASE_URL` y
`CRON_SECRET` habilitados para *Preview* (y Development), no solo Production. Cualquier
build de PR o rama pega contra los datos reales. `WHATSAPP_TOKEN` sí está limitado a
Production, así que un preview no manda WhatsApps de verdad — pero sí puede escribir
`Customer`, `MessageLog`, `Store` reales, y dispararía los crons de verdad si alguien pega
al endpoint con el `CRON_SECRET` filtrado en ese build. **No probar nada en un preview que
toque la base hasta que esto se separe (bloque B).**

---

## Trampas ya conocidas (de sesiones anteriores)

- **`npm audit fix --force` degrada Next 16 → 9.** Nunca correrlo en este repo. `--omit=dev`
  rompe el build.
- **`prisma migrate dev` resetea el tracking de curiosos.** No usarlo contra la base real.
- **El dashboard no levanta en local** (Prisma + DB). Mirarlo en
  `mw-micelium.vercel.app/dashboard`.
- **Tiendanube escapa `<script>`** en external-codes: usar `<img onerror>` + un `.js` en
  `public/`, y agregar la ruta a `PUBLICOS` en `middleware.ts`.

---

## Cómo se trabaja acá

- **Migraciones**: siempre por Prisma. `scripts/aplicar-sql.js` es deuda, no una herramienta.
- **Rutas públicas**: toda ruta nueva bajo `/api` que reciba tráfico anónimo entra a mano en
  `API_ABIERTAS` (`middleware.ts`) y valida lo suyo — firma HMAC, `CRON_SECRET` o rate limit.
  El prefijo se compara con `startsWith`: cuidado con abrir un prefijo que arrastre rutas
  privadas.
- **Modo de falla explícito**: `lib/ratelimit.ts` obliga a elegir `permitir` o `rechazar`.
  Donde se juega plata (llamadas a Claude) va `rechazar`.
- **Credenciales de tienda**: siempre por `lib/credenciales.ts`, nunca leyendo
  `store.whatsapp_api_token` directo. Es el único punto donde va a entrar el cifrado.
- **Widgets**: son datos, no código. Un texto o un cambio de estado se hace desde
  `/dashboard/widgets`, sin desplegar.
- **Comentarios**: los de `credenciales.ts`, `ratelimit.ts` y `session.ts` explican el modo
  de fallo que motivó cada decisión. Si vas a deshacer algo de ahí, leé el porqué primero.
- **Blog y contenido**: los posts van siempre en borrador (`#draft`).

---

## Cuidado especial

- El bot atiende clientes reales. Cualquier cambio en `app/api/webhooks/whatsapp/route.ts`
  puede mandar mensajes de verdad: probar contra un número propio.
- `verificarFirmaMeta` y `chequearCron` son lo único que impide que un tercero mande
  WhatsApps desde el número oficial. Ya tienen tests de regresión
  (`tests/meta-signature.test.ts`, `tests/cron-auth.test.ts`) — no relajar ninguno de los
  dos sin que esos tests sigan pasando.
- Hay datos personales (teléfonos, emails, fotos, conversaciones) sin política de retención.
  No agregar campos nuevos de PII sin decidir cuánto se guardan.
- **Heartbeat de crons** (`lib/cron-heartbeat.ts`): todo cron periódico nuevo debe llamar a
  `marcarHeartbeat(nombre, ok)` al terminar, y sumarse a `MAX_ANTIGUEDAD_HORAS` si tiene una
  cadencia fija. Si no se hace, el cron puede morir en silencio igual que antes.
- **Cola de envíos** (`lib/cola-envios.ts`): las filas se toman con `FOR UPDATE SKIP
  LOCKED`, no con `findMany`. Si alguna vez el consumidor vuelve a leer sin tomar, dos
  corridas solapadas le mandan el mismo mensaje dos veces al cliente. El estado de la cola
  sale en el mail diario de `resumen-bot`, no en el dashboard.
- **Logs**: en caminos críticos usar `log` de `@/lib/log`, no `console.error` suelto. La
  salida es JSON con `ambito` / `trace_id` / `store_id` en la raíz, que es lo que permite
  filtrar en Vercel. Un `console.error('algo:', e)` no se puede consultar después.
- **Alertas**: las tres que existen (cola, crons caídos, gasto de Claude) salen del cron
  `resumen-bot` por mail. Antes de agregar una cuarta, pensar si se va a leer: una alerta
  que dispara todos los días se ignora, y entonces las otras tres también.
- Hay 6 proyectos de Vercel con nombres parecidos (`motor-whatsapp`, `motor-whatsapp2`,
  `motor-whatsapp-mic`, `motor-whatsapp-micelium`, `motor-whatsapp-id1k`, `mw-micelium`).
  El que sirve producción es **`mw-micelium`**. Los otros parecen imports/pruebas viejas —
  no se tocaron (borrar proyectos de Vercel es una acción que confirmás vos, no algo para
  decidir desde acá).
