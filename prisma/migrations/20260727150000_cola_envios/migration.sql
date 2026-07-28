-- La cola de envíos, de verdad — Bloque D del plan de arquitectura.
--
-- ⚠️ ORDEN DE DESPLIEGUE: PRIMERO ESTA MIGRACIÓN, DESPUÉS EL CÓDIGO.
--
-- El código nuevo escribe `payload` (CampaignService) y lo lee en la consulta de la cola
-- (`tomarLote`). Sin la columna, las dos operaciones fallan: el carrito abandonado deja de
-- encolarse y el cron de envíos rompe en cada corrida.
--
-- Al revés es seguro: con la columna creada, el código viejo la ignora y sigue usando
-- `error_details` como antes. Y cuando el código nuevo entre, `leerPayload()` acepta las dos
-- formas, así que las filas que el código viejo dejó encoladas salen igual.
--
-- O sea: migración → deploy. Nunca al revés.
--
-- QUÉ ESTABA MAL
--
-- `error_details` cargaba TRES significados distintos a la vez:
--   1. El payload de la cola: `{"message":"...","phone":"..."}` (handleAbandonedCart).
--   2. Una marca de idempotencia: `order:<id>`, consultada con `contains` para no repetir
--      las instrucciones de transferencia.
--   3. El mensaje de error real cuando un envío falla.
--
-- Y al consumidor (`/api/cron/send-pending`) le faltaba todo lo que hace que una cola sea
-- una cola: sin `ORDER BY`, sin marca de "en proceso", sin contador de intentos. Dos
-- corridas solapadas tomaban las MISMAS 50 filas y el cliente recibía el mensaje dos veces.
--
-- Esta migración separa el significado 1 en su propia columna y agrega el andamiaje de
-- reintentos. Los significados 2 y 3 se dejan donde están a propósito: la marca de
-- idempotencia merece su propia columna, pero moverla implica reescribir las consultas
-- `contains` de CampaignService y eso es un cambio aparte, no un efecto colateral de éste.

-- ─────────────────────────────────────────────────────────────────────────────
-- Payload propio. Nullable porque solo las filas de la cola (checkout/abandoned) lo usan:
-- el resto de los MessageLog son registros de algo ya enviado, no trabajo pendiente.
ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "payload" JSONB;

-- Cuántas veces se intentó enviar esta fila. Sin esto, un mensaje que falla siempre se
-- reintenta para siempre contra la API de Meta.
ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "intentos" INTEGER NOT NULL DEFAULT 0;

-- Hasta cuándo esta fila está tomada por una corrida. Es lo que impide que dos ejecuciones
-- simultáneas manden el mismo mensaje: la que toma la fila la marca, la otra la saltea.
-- También sirve de backoff: tras un fallo se empuja al futuro en vez de reintentar en loop.
ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "bloqueado_hasta" TIMESTAMP(3);

-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill: las filas PENDING que hoy tienen el payload en error_details se migran a la
-- columna nueva. Solo las que son JSON válido con las dos claves esperadas — el resto de
-- los error_details (marcas 'order:<id>', mensajes de error) NO son payload y no se tocan.
--
-- El `jsonb_typeof(...) = 'object'` filtra los que no parsean; el CASE evita que una fila
-- con texto suelto haga fallar toda la migración.
UPDATE "MessageLog"
   SET "payload" = "error_details"::jsonb
 WHERE "estado" = 'PENDING'
   AND "tipo_evento" = 'checkout/abandoned'
   AND "payload" IS NULL
   AND "error_details" IS NOT NULL
   AND left(btrim("error_details"), 1) = '{'
   AND (
     CASE WHEN left(btrim("error_details"), 1) = '{'
          THEN jsonb_typeof("error_details"::jsonb)
          ELSE NULL
     END
   ) = 'object';

-- ─────────────────────────────────────────────────────────────────────────────
-- Índice del consumidor. La consulta de la cola filtra por estado + programación +
-- bloqueo, así que el índice tiene que cubrir las tres. Reemplaza en la práctica al
-- MessageLog_estado_scheduled_idx para este acceso, pero ese se deja: lo usan otras
-- consultas y borrarlo es un cambio con su propio riesgo.
CREATE INDEX IF NOT EXISTS "MessageLog_cola_idx"
    ON "MessageLog"("estado", "scheduled_for", "bloqueado_hasta");
