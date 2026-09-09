-- Acuse de que el material post-venta le llegó al comprador.
--
-- El envío del manual (VPS) y el del paquete (panel) eran dos sistemas que no se hablaban:
-- la única memoria de los manuales era un .jsonl local, así que "¿quién quedó sin manual?"
-- no se podía contestar desde el panel. Esta tabla trae ese acuse para poder cruzarlo.
--
-- Guarda solo ENTREGAS, nunca pendientes: los faltantes se derivan cruzando contra
-- EnvioSeguimiento. Una tabla de pendientes habría que acordarse de vaciarla, y eso es
-- justo lo que vuelve a dejar gente afuera en silencio.
CREATE TABLE "EntregaManual" (
    -- <nº de pedido TN>:<sku>, la misma clave de dedup que ya usa el script del VPS.
    "id" TEXT NOT NULL,
    -- TEXT y no INTEGER: se compara contra EnvioSeguimiento.referencia, que es TEXT.
    -- Un cast en cada join es una fuente de bugs silenciosos.
    "referencia" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "producto" TEXT,
    "email" TEXT,
    -- Cuándo se mandó el mail (el acuse). creado_at solo dice cuándo se enteró el panel.
    "enviado_at" TIMESTAMP(3) NOT NULL,
    "creado_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntregaManual_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EntregaManual_referencia_idx" ON "EntregaManual"("referencia");
CREATE INDEX "EntregaManual_enviado_at_idx" ON "EntregaManual"("enviado_at");
