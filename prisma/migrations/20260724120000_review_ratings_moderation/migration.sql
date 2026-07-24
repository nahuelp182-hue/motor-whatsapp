-- Extiende Review para servir los dos caminos: reseñas propias (WhatsApp + formulario
-- público con moderación) y reseñas verificadas de Google. Todo aditivo y sin pérdida:
-- las filas existentes quedan aprobadas, source 'whatsapp', sin rating.

-- customer_id pasa a opcional: una reseña de Google o de un formulario no es un Customer.
ALTER TABLE "Review" ALTER COLUMN "customer_id" DROP NOT NULL;

ALTER TABLE "Review" ADD COLUMN "autor" TEXT;
ALTER TABLE "Review" ADD COLUMN "rating" INTEGER;
ALTER TABLE "Review" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'whatsapp';
ALTER TABLE "Review" ADD COLUMN "approved" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Review" ADD COLUMN "fecha" TIMESTAMP(3);
ALTER TABLE "Review" ADD COLUMN "external_id" TEXT;

-- NULLs se consideran distintos en un UNIQUE de Postgres, así que las filas actuales
-- (external_id NULL) no chocan. Solo evita duplicar la MISMA reseña de Google entre syncs.
CREATE UNIQUE INDEX "Review_source_external_id_key" ON "Review"("source", "external_id");
CREATE INDEX "Review_store_id_approved_source_idx" ON "Review"("store_id", "approved", "source");
