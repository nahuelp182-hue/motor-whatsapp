-- Cada reseña puede apuntar a un producto (para filtrar por ficha) y llevar una foto que
-- sube el cliente. Todo aditivo y nullable: las reseñas existentes quedan sin producto ni foto.

ALTER TABLE "Review" ADD COLUMN "product_id" TEXT;
ALTER TABLE "Review" ADD COLUMN "product_nombre" TEXT;
ALTER TABLE "Review" ADD COLUMN "foto_url" TEXT;

CREATE INDEX "Review_store_id_approved_product_id_idx" ON "Review"("store_id", "approved", "product_id");
