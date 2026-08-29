-- Faltan CINCO tablas del historial de migraciones: Widget, WidgetEvent, WidgetLead,
-- Visitor, Visit y gads_cache (esta última con nombre en minúscula por @@map).
--
-- Las seis existen en producción (Micelium) y en schema.prisma, pero ningún archivo de
-- prisma/migrations/ contiene sus CREATE TABLE. Tuvieron que crearse por fuera del
-- historial de Prisma —a mano, o con `db push`— y nunca quedaron registradas como
-- migración formal. Es la deuda que PLAN_ARQUITECTURA.md (bloque C) ya documentaba:
-- "Adoptar en schema.prisma las 5 tablas que hoy viven solo en producción... Bloqueado:
-- requiere prisma db pull contra la base real".
--
-- Eso no se notaba porque la única base que existía (Micelium) ya las tenía todas.
-- Descubierto el 28/08/2026 al aplicar las migraciones a una base NUEVA (Osamayor, la
-- segunda tienda): 20260727140000_integridad_esquema referencia Widget, Visitor y
-- gads_cache, y WidgetEvent/WidgetLead dependen de Widget vía FK. Sin estos CREATE TABLE
-- antes, esa migración falla en cascada con "relation ... does not exist".
--
-- DDL sacado con `prisma migrate diff --to-schema prisma/schema.prisma`, no escrito a
-- mano: así queda garantizado que coincide exactamente con lo que Prisma espera.
--
-- Esta migración va con timestamp ANTERIOR a integridad_esquema (135900 < 140000) para que
-- el orden de aplicación quede correcto en cualquier base que arranque de cero.
--
-- IMPORTANTE si esto se aplica alguna vez contra Micelium: las tablas ya existen ahí, así
-- que todo usa IF NOT EXISTS — no se puede usar `prisma migrate resolve --applied` en una
-- base que ya tiene el checksum de integridad_esquema aplicado sin esta, porque Prisma
-- rechaza insertar una migración con timestamp anterior a la última aplicada. Por eso en
-- Micelium esta migración hay que marcarla como ya aplicada a mano
-- (`prisma migrate resolve --applied 20260727135900_widget_lead_faltante`) ANTES de correr
-- `migrate deploy`, sin ejecutar este SQL — las tablas reales de Micelium pueden tener
-- filas que este script no debe tocar.

CREATE TABLE IF NOT EXISTS "gads_cache" (
    "id" TEXT NOT NULL,
    "store_id" TEXT,
    "date" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "campaign_name" TEXT NOT NULL,
    "campaign_status" TEXT NOT NULL,
    "campaign_type" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "cost_ars" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conv_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gads_cache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Visitor" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "vid" TEXT NOT NULL,
    "ft_channel" TEXT NOT NULL,
    "ft_source" TEXT,
    "ft_campaign" TEXT,
    "ft_landing" TEXT,
    "ft_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email" TEXT,
    "order_number" INTEGER,
    "purchased_at" TIMESTAMP(3),
    "total_orden" DECIMAL(10,2),
    "last_seen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Visit" (
    "id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "max_scroll" INTEGER NOT NULL DEFAULT 0,
    "pageviews" INTEGER NOT NULL DEFAULT 1,
    "viewed_product" BOOLEAN NOT NULL DEFAULT false,
    "engaged" BOOLEAN NOT NULL DEFAULT false,
    "channel" TEXT NOT NULL,
    "landing" TEXT,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Widget" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "contexto" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "reglas" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Widget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WidgetEvent" (
    "id" TEXT NOT NULL,
    "widget_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "vid" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WidgetLead" (
    "id" TEXT NOT NULL,
    "widget_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "dato" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WidgetLead_pkey" PRIMARY KEY ("id")
);

-- Índices y FKs: cada uno con IF NOT EXISTS / verificado antes en el caso de las FK, porque
-- Postgres no tiene "ADD CONSTRAINT IF NOT EXISTS" — se resuelve con un bloque DO.
CREATE UNIQUE INDEX IF NOT EXISTS "gads_cache_date_campaign_id_key" ON "gads_cache"("date", "campaign_id");
CREATE INDEX IF NOT EXISTS "gads_cache_store_date_idx" ON "gads_cache"("store_id", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "Visitor_store_id_vid_key" ON "Visitor"("store_id", "vid");
CREATE INDEX IF NOT EXISTS "Visitor_store_id_ft_channel_idx" ON "Visitor"("store_id", "ft_channel");
CREATE INDEX IF NOT EXISTS "Visitor_store_id_ft_at_idx" ON "Visitor"("store_id", "ft_at");
CREATE INDEX IF NOT EXISTS "Visitor_store_email_idx" ON "Visitor"("store_id", "email");

CREATE INDEX IF NOT EXISTS "Visit_visitor_id_idx" ON "Visit"("visitor_id");
CREATE INDEX IF NOT EXISTS "Visit_started_at_idx" ON "Visit"("started_at");

CREATE INDEX IF NOT EXISTS "Widget_store_id_contexto_activo_idx" ON "Widget"("store_id", "contexto", "activo");

CREATE INDEX IF NOT EXISTS "WidgetEvent_widget_id_tipo_createdAt_idx" ON "WidgetEvent"("widget_id", "tipo", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "WidgetLead_widget_id_email_key" ON "WidgetLead"("widget_id", "email");
CREATE INDEX IF NOT EXISTS "WidgetLead_createdAt_idx" ON "WidgetLead"("createdAt");

DO $$ BEGIN
    ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_store_id_fkey"
        FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Visit" ADD CONSTRAINT "Visit_visitor_id_fkey"
        FOREIGN KEY ("visitor_id") REFERENCES "Visitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "Widget" ADD CONSTRAINT "Widget_store_id_fkey"
        FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE "WidgetEvent" ADD CONSTRAINT "WidgetEvent_widget_id_fkey"
        FOREIGN KEY ("widget_id") REFERENCES "Widget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
