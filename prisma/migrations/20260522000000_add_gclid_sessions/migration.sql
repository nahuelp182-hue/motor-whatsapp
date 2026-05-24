CREATE TABLE "GclidSession" (
    "id"         TEXT NOT NULL,
    "store_id"   TEXT NOT NULL,
    "gclid"      TEXT NOT NULL,
    "phone"      TEXT,
    "order_id"   TEXT,
    "uploaded"   BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GclidSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GclidSession_store_id_phone_idx" ON "GclidSession"("store_id", "phone");
CREATE INDEX "GclidSession_store_id_gclid_idx" ON "GclidSession"("store_id", "gclid");

ALTER TABLE "GclidSession" ADD CONSTRAINT "GclidSession_store_id_fkey"
    FOREIGN KEY ("store_id") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;