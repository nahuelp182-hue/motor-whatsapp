-- Producción y Caja del panel de Operación.
-- ConteoStock: el único dato que se carga a mano (las unidades se cuentan mirando el estante).
-- CorteCaja: resultado del corte quincenal que ya calcula el VPS; acá solo se guarda.
CREATE TABLE "ConteoStock" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "unidades" INTEGER NOT NULL,
    "nota" TEXT,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConteoStock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConteoStock_fecha_idx" ON "ConteoStock"("fecha");

CREATE TABLE "CorteCaja" (
    "id" TEXT NOT NULL,
    "desde" TIMESTAMP(3) NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,
    "bruto" DOUBLE PRECISION NOT NULL,
    "neto" DOUBLE PRECISION NOT NULL,
    "liberado" DOUBLE PRECISION NOT NULL,
    "pendiente" DOUBLE PRECISION NOT NULL,
    "lineas" JSONB NOT NULL,
    "actualizado" TIMESTAMP(3) NOT NULL,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorteCaja_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CorteCaja_desde_idx" ON "CorteCaja"("desde");
