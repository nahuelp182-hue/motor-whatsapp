-- MercadoLibre en el panel de Operación.
-- El VPS es dueño único del token de ML (lo rota en cada uso), así que consulta él y empuja.
-- VentaMl guarda la ORDEN, no un agregado: el Resumen compara ventanas móviles contra su
-- período previo, y eso no se reconstruye desde totales ya sumados.
CREATE TABLE "VentaMl" (
    "order_id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "unidades" INTEGER NOT NULL DEFAULT 1,
    "titulo" TEXT,
    "sku" TEXT,
    "canal" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VentaMl_pkey" PRIMARY KEY ("order_id")
);

CREATE INDEX "VentaMl_fecha_idx" ON "VentaMl"("fecha");
CREATE INDEX "VentaMl_canal_fecha_idx" ON "VentaMl"("canal", "fecha");

CREATE TABLE "ReputacionMl" (
    "id" TEXT NOT NULL,
    "nivel" TEXT NOT NULL,
    "completadas" INTEGER NOT NULL,
    "canceladas" INTEGER NOT NULL,
    "reclamos" DOUBLE PRECISION,
    "demoras" DOUBLE PRECISION,
    "leido_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputacionMl_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReputacionMl_leido_at_idx" ON "ReputacionMl"("leido_at");
