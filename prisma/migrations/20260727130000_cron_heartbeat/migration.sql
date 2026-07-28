-- Los crons disparados desde el VPS (carrito-abandonado, resena-post-entrega, andreani,
-- instalar-widgets-tn) no dejan rastro si el VPS se cae: el cron simplemente no corre y
-- nada lo nota hasta que alguien mira que el recupero de carrito dejó de mandar mensajes.
--
-- Esta tabla es la mitad barata del arreglo: cada cron (VPS o Vercel) escribe una fila al
-- terminar. La otra mitad —quién avisa cuando una fila deja de actualizarse— vive en
-- lib/cron-heartbeat.ts y se dispara desde el cron resumen-bot (ver Bloque A del plan de
-- arquitectura). No se agrega un cron nuevo para chequear: mientras no esté confirmado el
-- plan de Vercel, un cron nuevo podría no llegar a correr nunca.
CREATE TABLE IF NOT EXISTS "CronHeartbeat" (
    "nombre"    TEXT PRIMARY KEY,
    "last_run"  TIMESTAMP(3) NOT NULL DEFAULT now(),
    "last_ok"   BOOLEAN NOT NULL DEFAULT true,
    "detalle"   TEXT
);
