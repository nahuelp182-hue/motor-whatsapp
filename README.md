# motor-whatsapp

Plataforma interna de Micelium Argentina. Next.js 16 (App Router) + Prisma + Postgres
(Supabase), desplegada en Vercel como **`mw-micelium`**.

Contiene el bot de WhatsApp, el portal de guías (`guias.infomicelium.com.ar`), el motor de
widgets del storefront, el tracking de visitantes, el radar de tendencias, el calendario
comercial y la atribución de campañas.

- **Trampas y convenciones del proyecto**: [`CLAUDE.md`](./CLAUDE.md) — leer antes de tocar nada.
- **Cuando algo se rompe**: [`RUNBOOK.md`](./RUNBOOK.md) — incluye cómo frenar los envíos.
- **Estado técnico y plan de correcciones**: [`PLAN_ARQUITECTURA.md`](./PLAN_ARQUITECTURA.md).

---

## Levantarlo

```bash
npm install
npx prisma generate     # obligatorio: sin esto el cliente de Prisma no existe
npm run dev
```

**El dashboard no levanta bien en local** (Prisma no conecta con la configuración de
desarrollo). Para mirarlo, usar producción: `mw-micelium.vercel.app/dashboard`. La capa
pública de guías y los widgets sí funcionan en local.

## Verificar antes de pushear

```bash
npx tsc --noEmit
npm test
```

El CI (`.github/workflows/ci.yml`) corre lo mismo y bloquea el merge si falla. El lint corre
pero todavía no bloquea: hay errores preexistentes en código de la app.

---

## Variables de entorno

Se cargan en Vercel. Las críticas, sin las cuales el proyecto no arranca o falla cerrado:

| Variable | Para qué |
|---|---|
| `DB_HOST` `DB_PORT` `DB_USER` `DB_PASSWORD` | Conexión de runtime (pooler de Supabase) |
| `DATABASE_URL` | Conexión de **migraciones** (Prisma CLI). Ver la trampa en `CLAUDE.md`: no es el mismo camino que el runtime |
| `DASHBOARD_PASSWORD` | Sesión del panel. Sin esto, en producción el panel devuelve 503 (falla cerrado, a propósito) |
| `CRON_SECRET` | Autoriza todo `/api/cron/*`. Sin esto, los crons devuelven 503 |
| `WHATSAPP_TOKEN` `WHATSAPP_PHONE_NUMBER_ID` `WHATSAPP_APP_SECRET` `WHATSAPP_VERIFY_TOKEN` | Bot de WhatsApp. El `APP_SECRET` valida la firma de los webhooks: sin él, en producción se rechaza todo |
| `TN_STORE_ID` `TN_ACCESS_TOKEN` `TN_APP_ID` `TN_CLIENT_SECRET` | Tiendanube |
| `ANTHROPIC_API_KEY` | Cerebro del bot y del asistente web |

Opcionales según la función: `META_ADS_TOKEN`, `META_APP_SECRET`, `IG_ACCOUNT_ID`,
`FB_PAGE_TOKEN` (Meta/Instagram) · `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `ALERT_EMAIL`,
`MAIL_REMITENTE` (mails y alertas) · `GOOGLE_*`, `GADS_*` (Google Ads) · `GA4_PROPERTY_ID`,
`CLARITY_*` (analítica) · `GCAL_ECOMMERCE_ID`, `GOOGLE_SA_JSON_B64` (calendario) ·
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (avisos) · `YOUTUBE_API_KEY` (radar) ·
`BLOB_READ_WRITE_TOKEN` (fotos de reseñas) · `LEADS_NURTURE_ENABLED` (interruptor de la
secuencia de leads) · `DB_SSL_STRICT` (ver abajo).

`DB_SSL_STRICT=1` activa la validación del certificado de la base. Está apagado por
defecto porque encenderlo sin probarlo primero contra la base real rompería toda consulta
en producción — es un paso pendiente del Bloque C.

`CLAUDE_TOPE_USD_DIA` (default `5`) es el umbral de gasto diario de Claude que dispara el
aviso por mail. El default está puesto a ojo: ajustarlo con el primer dato real de
`claude_usage`.

---

## Base de datos

Migraciones **siempre** por Prisma:

```bash
npx prisma migrate deploy    # aplicar las pendientes (producción)
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma
```

**Nunca** `prisma migrate dev` contra la base real: resetea el tracking de visitantes.
`scripts/aplicar-sql.js` es deuda técnica, no una herramienta — se retira en el Bloque C.

## Crons

Cinco están declarados en `vercel.json` (diarios). Otros cuatro —`carrito-abandonado`,
`resena-post-entrega`, `andreani`, `instalar-widgets-tn`— los dispara un cron del VPS,
porque Vercel Hobby no permite frecuencias menores a un día.

Todos los periódicos reportan a la tabla `CronHeartbeat`; el cron `resumen-bot` avisa por
mail si alguno dejó de llegar. **Un cron nuevo tiene que llamar a `marcarHeartbeat()`** o
podrá morir en silencio.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://mw-micelium.vercel.app/api/cron/<nombre>
```
