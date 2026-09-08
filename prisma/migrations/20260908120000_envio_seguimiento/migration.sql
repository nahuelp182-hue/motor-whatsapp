-- Histórico de envíos del panel de Operación.
-- Andreani solo informa el estado actual: sin esta tabla no hay forma de calcular días a
-- destino, cumplimiento del plazo ni demora por provincia. Se llena desde el cron.
CREATE TABLE "EnvioSeguimiento" (
    "tracking" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "cliente" TEXT,
    "producto" TEXT,
    "provincia" TEXT,
    "despachado_at" TIMESTAMP(3),
    "entregado_at" TIMESTAMP(3),
    "estado" TEXT NOT NULL,
    "orden" INTEGER,
    "error" TEXT,
    "visto_at" TIMESTAMP(3) NOT NULL,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvioSeguimiento_pkey" PRIMARY KEY ("tracking")
);

CREATE INDEX "EnvioSeguimiento_estado_despachado_at_idx" ON "EnvioSeguimiento"("estado", "despachado_at");
CREATE INDEX "EnvioSeguimiento_entregado_at_idx" ON "EnvioSeguimiento"("entregado_at");
CREATE INDEX "EnvioSeguimiento_provincia_entregado_at_idx" ON "EnvioSeguimiento"("provincia", "entregado_at");
