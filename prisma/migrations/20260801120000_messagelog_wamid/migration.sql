-- El wamid que devuelve la Cloud API al aceptar un mensaje. Es la llave contra WaStatus:
-- sin él, estado='SENT' solo prueba que Meta aceptó el pedido, no que el mensaje llegó
-- (el error 131047, fuera de la ventana de 24 h, responde 200 y no entrega).
--
-- Columna propia y no dentro de `payload`: ese campo ya significa "lo que hay que enviar"
-- para la cola de envíos, y darle un segundo sentido repetiría el problema de error_details.
ALTER TABLE "MessageLog" ADD COLUMN IF NOT EXISTS "wamid" TEXT;

-- El cruce contra WaStatus es por wamid y filtrado por fecha.
CREATE INDEX IF NOT EXISTS "MessageLog_wamid_idx" ON "MessageLog" ("wamid");

-- Canal por el que entró o salió cada evento de diagnóstico. ig_diag vive fuera de Prisma
-- (ver CLAUDE.md), pero la columna se declara acá para que quede en el historial: hasta
-- ahora la única marca era detail->>'ch', que solo ponía WhatsApp, y por eso el webhook de
-- Instagram estuvo tres semanas sin recibir mensajes sin que nadie lo notara.
ALTER TABLE ig_diag ADD COLUMN IF NOT EXISTS canal TEXT;
CREATE INDEX IF NOT EXISTS ig_diag_canal_ts_idx ON ig_diag (canal, ts DESC);
