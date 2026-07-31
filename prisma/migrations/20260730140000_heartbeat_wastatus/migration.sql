CREATE TABLE IF NOT EXISTS "Heartbeat" (
    "nombre" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    "alertado" TIMESTAMP(3),

    CONSTRAINT "Heartbeat_pkey" PRIMARY KEY ("nombre")
);

CREATE TABLE IF NOT EXISTS "WaStatus" (
    "wamid" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "destino" TEXT,
    "error_code" INTEGER,
    "error_desc" TEXT,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaStatus_pkey" PRIMARY KEY ("wamid")
);

CREATE INDEX IF NOT EXISTS "WaStatus_estado_ts_idx" ON "WaStatus"("estado", "ts");
