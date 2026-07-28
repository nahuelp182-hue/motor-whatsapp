-- Integridad del esquema — Bloque C del plan de arquitectura.
--
-- Cuatro arreglos que comparten una característica: hoy no rompen nada porque hay UNA sola
-- tienda y pocos datos. Los cuatro se vuelven un problema real el día que eso cambie, y
-- arreglarlos entonces implica migrar datos en vez de agregar una restricción.
--
-- Esta migración corre en una transacción: si algo falla, no queda nada a medias.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. WidgetLead no tenía clave foránea a Widget.
--
-- La columna widget_id existía y se usaba, pero sin FK: borrar un widget dejaba sus leads
-- (emails de gente real) colgando de un id que ya no apunta a nada. No se pierden datos,
-- pero dejan de ser recuperables desde el panel — quedan invisibles.
--
-- ON DELETE CASCADE es deliberado: un lead capturado por un widget que ya no existe no
-- tiene forma de mostrarse ni de atribuirse. Si en algún momento los leads tienen que
-- sobrevivir al widget, lo correcto es copiarlos a su propia tabla ANTES de borrarlo, no
-- dejarlos huérfanos.
--
-- SI ESTA MIGRACIÓN FALLA ACÁ: hay filas huérfanas de antes. Inspeccionarlas con
--   SELECT l.* FROM "WidgetLead" l
--    LEFT JOIN "Widget" w ON w.id = l.widget_id WHERE w.id IS NULL;
-- y decidir a mano si se rescatan o se borran. La transacción hace rollback sola, así que
-- un fallo acá no deja la base a medio migrar.
ALTER TABLE "WidgetLead"
    ADD CONSTRAINT "WidgetLead_widget_id_fkey"
    FOREIGN KEY ("widget_id") REFERENCES "Widget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Coupon.codigo era único GLOBAL, no por tienda.
--
-- Con una tienda da igual. Con dos, la primera que emita el código "BIENVENIDA10" le
-- impide a la otra usar ese texto: un cupón de un cliente bloqueando el catálogo de otro.
-- El cambio es estrictamente más permisivo, así que no puede fallar por datos existentes.
ALTER TABLE "Coupon" DROP CONSTRAINT IF EXISTS "Coupon_codigo_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Coupon_store_codigo_key" ON "Coupon"("store_id", "codigo");

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. gads_cache no tenía store_id: era una tabla global colgada de un modelo multi-tenant.
--
-- Se agrega NULLABLE a propósito. Ponerla NOT NULL exigiría inventar a qué tienda pertenece
-- cada fila histórica, y la respuesta correcta ("a la única que existe") es verdad hoy pero
-- no es algo que una migración deba asumir por su cuenta.
--
-- El backfill de abajo solo corre si hay EXACTAMENTE una tienda: en ese caso no hay
-- ambigüedad posible. Con dos o más, no toca nada y las filas viejas quedan en NULL para
-- que alguien decida con criterio.
ALTER TABLE "gads_cache" ADD COLUMN IF NOT EXISTS "store_id" TEXT;

DO $$
DECLARE unica TEXT;
BEGIN
    SELECT id INTO unica FROM "Store" LIMIT 1;
    IF (SELECT count(*) FROM "Store") = 1 THEN
        UPDATE "gads_cache" SET "store_id" = unica WHERE "store_id" IS NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "gads_cache_store_date_idx" ON "gads_cache"("store_id", "date");

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Visitor.email sin índice, siendo la columna por la que se cose la compra.
--
-- El cosido de compras (cron del VPS que cruza pedidos de Tiendanube contra visitantes)
-- busca por email en cada corrida. Sin índice eso es un scan de toda la tabla de
-- visitantes, que es la que más rápido crece del proyecto.
CREATE INDEX IF NOT EXISTS "Visitor_store_email_idx" ON "Visitor"("store_id", "email");
