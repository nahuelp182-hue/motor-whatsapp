-- Tablas del sistema de curiosos. Aditivo y seguro: IF NOT EXISTS, no toca nada existente.
-- Calcado del esquema Prisma (models Visitor y Visit). Nombres de índices igual que
-- los que generaría Prisma, para que futuras migraciones los vean como coincidentes.

CREATE TABLE IF NOT EXISTS "Visitor" (
  "id"            TEXT NOT NULL,
  "store_id"      TEXT NOT NULL,
  "vid"           TEXT NOT NULL,
  "ft_channel"    TEXT NOT NULL,
  "ft_source"     TEXT,
  "ft_campaign"   TEXT,
  "ft_landing"    TEXT,
  "ft_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "email"         TEXT,
  "order_number"  INTEGER,
  "purchased_at"  TIMESTAMP(3),
  "last_seen"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Visit" (
  "id"             TEXT NOT NULL,
  "visitor_id"     TEXT NOT NULL,
  "started_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "duration_ms"    INTEGER NOT NULL DEFAULT 0,
  "max_scroll"     INTEGER NOT NULL DEFAULT 0,
  "pageviews"      INTEGER NOT NULL DEFAULT 1,
  "viewed_product" BOOLEAN NOT NULL DEFAULT false,
  "engaged"        BOOLEAN NOT NULL DEFAULT false,
  "channel"        TEXT NOT NULL,
  "landing"        TEXT,
  CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Visitor_store_id_vid_key"     ON "Visitor" ("store_id", "vid");
CREATE INDEX        IF NOT EXISTS "Visitor_store_id_ft_channel_idx" ON "Visitor" ("store_id", "ft_channel");
CREATE INDEX        IF NOT EXISTS "Visitor_store_id_ft_at_idx"    ON "Visitor" ("store_id", "ft_at");
CREATE INDEX        IF NOT EXISTS "Visit_visitor_id_idx"          ON "Visit" ("visitor_id");
CREATE INDEX        IF NOT EXISTS "Visit_started_at_idx"          ON "Visit" ("started_at");

-- Claves foráneas (mismas convenciones que Prisma: UPDATE CASCADE / DELETE RESTRICT).
DO $$ BEGIN
  ALTER TABLE "Visitor" ADD CONSTRAINT "Visitor_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Visit" ADD CONSTRAINT "Visit_visitor_id_fkey"
    FOREIGN KEY ("visitor_id") REFERENCES "Visitor"("id") ON UPDATE CASCADE ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
