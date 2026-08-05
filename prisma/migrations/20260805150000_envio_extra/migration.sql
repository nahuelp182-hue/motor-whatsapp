-- Envío adicional sobre un pedido de Tiendanube que ya tiene su propio tracking principal
-- (accesorio faltante despachado aparte, cambio de garantía, etc).
CREATE TABLE "EnvioExtra" (
    "id" TEXT NOT NULL,
    "orden_numero" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "tracking" TEXT NOT NULL,
    "esAndreani" BOOLEAN NOT NULL DEFAULT true,
    "despachado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvioExtra_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EnvioExtra_orden_numero_idx" ON "EnvioExtra"("orden_numero");
