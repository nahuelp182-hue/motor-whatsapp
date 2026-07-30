CREATE TABLE IF NOT EXISTS "EnvioApicola" (
    "interno" INTEGER NOT NULL,
    "shipment_id" TEXT NOT NULL,
    "ml_order_id" TEXT NOT NULL,
    "fecha_compra" TIMESTAMP(3) NOT NULL,
    "cliente" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "unidades" INTEGER NOT NULL DEFAULT 1,
    "estado" TEXT NOT NULL,
    "wamid" TEXT,
    "wa_entregado" BOOLEAN NOT NULL DEFAULT false,
    "wa_intentos" INTEGER NOT NULL DEFAULT 0,
    "wa_detalle" TEXT,
    "enviado_at" TIMESTAMP(3),
    "despachado" BOOLEAN NOT NULL DEFAULT false,
    "avisos_tio" INTEGER NOT NULL DEFAULT 0,
    "escalados" INTEGER NOT NULL DEFAULT 0,
    "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvioApicola_pkey" PRIMARY KEY ("interno")
);

CREATE INDEX IF NOT EXISTS "EnvioApicola_fecha_compra_idx" ON "EnvioApicola"("fecha_compra");
