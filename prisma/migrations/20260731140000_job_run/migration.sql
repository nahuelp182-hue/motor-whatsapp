-- JobRun: una fila por corrida de automatización. Reemplaza a CronHeartbeat.
--
-- CronHeartbeat guardaba una fila por job vía upsert: alcanzaba para "¿corrió?" y para
-- nada más. No se puede saber si algo falla siempre o falló una vez, desde cuándo, ni si
-- está tardando más que antes — el upsert pisa la evidencia que hace falta justo cuando
-- algo se rompe.
--
-- No se migran datos: CronHeartbeat estuvo VACÍA desde que se creó (27/07) hasta el
-- 31/07, porque el código que la escribía nunca se había desplegado. No hay historia
-- que preservar.

CREATE TABLE "JobRun" (
    "id"          TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "origen"      TEXT NOT NULL,
    "inicio"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fin"         TIMESTAMP(3),
    "duracion_ms" INTEGER,
    "exit_code"   INTEGER,
    "ok"          BOOLEAN NOT NULL DEFAULT true,
    "detalle"     TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- El índice compuesto sirve a la consulta caliente del panel: "última corrida de este
-- job". El de inicio solo, a la poda por antigüedad.
CREATE INDEX "JobRun_slug_inicio_idx" ON "JobRun"("slug", "inicio");
CREATE INDEX "JobRun_inicio_idx" ON "JobRun"("inicio");

DROP TABLE IF EXISTS "CronHeartbeat";
