-- Tablas del motor de widgets. Aditivo y seguro: IF NOT EXISTS, no toca nada existente.
-- Calcado del esquema Prisma (models Widget, WidgetEvent, WidgetLead), con los nombres de
-- índice que generaría Prisma para que futuras migraciones los vean como coincidentes.

CREATE TABLE IF NOT EXISTS "Widget" (
  "id"        TEXT NOT NULL,
  "store_id"  TEXT NOT NULL,
  "tipo"      TEXT NOT NULL,
  "nombre"    TEXT NOT NULL,
  "contexto"  TEXT NOT NULL,
  "config"    JSONB NOT NULL,
  "reglas"    JSONB,
  "activo"    BOOLEAN NOT NULL DEFAULT false,
  "orden"     INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Widget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Widget_store_id_contexto_activo_idx"
  ON "Widget"("store_id", "contexto", "activo");

CREATE TABLE IF NOT EXISTS "WidgetEvent" (
  "id"        TEXT NOT NULL,
  "widget_id" TEXT NOT NULL,
  "tipo"      TEXT NOT NULL,
  "vid"       TEXT,
  "meta"      JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WidgetEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WidgetEvent_widget_id_tipo_createdAt_idx"
  ON "WidgetEvent"("widget_id", "tipo", "createdAt");

CREATE TABLE IF NOT EXISTS "WidgetLead" (
  "id"        TEXT NOT NULL,
  "widget_id" TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "dato"      JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WidgetLead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WidgetLead_widget_id_email_key"
  ON "WidgetLead"("widget_id", "email");
CREATE INDEX IF NOT EXISTS "WidgetLead_createdAt_idx" ON "WidgetLead"("createdAt");

-- Claves foráneas al final: si ya existen, el bloque se saltea sin abortar el script.
DO $$ BEGIN
  ALTER TABLE "Widget" ADD CONSTRAINT "Widget_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WidgetEvent" ADD CONSTRAINT "WidgetEvent_widget_id_fkey"
    FOREIGN KEY ("widget_id") REFERENCES "Widget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
