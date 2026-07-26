-- MessageLog es la tabla más consultada del proyecto (12 sitios de query) y no tenía un solo
-- índice: todo era sequential scan sobre una tabla que crece para siempre. Hoy no se nota;
-- a decenas de miles de filas el cron de send-pending empieza a arrastrarse.
--
-- Los cuatro índices salen de los patrones reales de consulta, no de adivinar:

-- 1. El más usado: los 6 chequeos de "¿ya le mandé esto a este cliente?" de CampaignService
--    (instrucciones de transferencia, recordatorio, carrito abandonado, reseña).
CREATE INDEX IF NOT EXISTS "MessageLog_store_customer_campaign_tipo_idx"
    ON "MessageLog"("store_id", "customer_id", "campaign_id", "tipo_evento");

-- 2. El cron diario /api/cron/send-pending: los recovery vencidos que faltan mandar.
--    Un índice parcial (WHERE estado = 'PENDING') sería más chico, pero Prisma no los sabe
--    expresar en el schema y quedaría marcado como drift para siempre: la próxima migración
--    intentaría "corregirlo". No vale el riesgo por unos KB.
CREATE INDEX IF NOT EXISTS "MessageLog_estado_scheduled_idx"
    ON "MessageLog"("estado", "scheduled_for");

-- 3. Métricas del panel: enviados y fallidos por período.
CREATE INDEX IF NOT EXISTS "MessageLog_store_estado_creado_idx"
    ON "MessageLog"("store_id", "estado", "createdAt");

-- 4. /api/marketing-automatico y la captura de reseñas del webhook de WhatsApp.
CREATE INDEX IF NOT EXISTS "MessageLog_store_tipo_creado_idx"
    ON "MessageLog"("store_id", "tipo_evento", "createdAt");
