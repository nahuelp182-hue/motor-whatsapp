-- Auditoría del sistema: una corrida de chequeos y sus resultados.
--
-- Se guarda el historial, no el último estado. Un chequeo que falla una vez y uno que falla
-- todos los días desde hace un mes piden reacciones opuestas, y con solo el estado actual
-- son indistinguibles.
--
-- OJO — DRIFT AJENO QUE NO SE TOCA ACÁ:
-- `prisma migrate diff` propone además crear "Review_customer_id_fkey", una foreign key que
-- el schema declara y la base no tiene. Es drift preexistente, sin relación con la
-- auditoría, y agregarla puede fallar si quedaron reviews apuntando a un customer borrado.
-- Se deja anotado para tratarlo aparte, con su propia verificación de huérfanos. Mezclarlo
-- acá haría que una migración de observabilidad pudiera voltear un deploy por un motivo que
-- no tiene nada que ver con ella.

CREATE TABLE "AuditoriaRun" (
    "id"          TEXT NOT NULL,
    "ts"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen"      TEXT NOT NULL,
    "duracion_ms" INTEGER,
    "total"       INTEGER NOT NULL DEFAULT 0,
    "ok"          INTEGER NOT NULL DEFAULT 0,
    "warn"        INTEGER NOT NULL DEFAULT 0,
    "fail"        INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AuditoriaRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditoriaCheck" (
    "id"     TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "clave"  TEXT NOT NULL,
    "grupo"  TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "valor"  TEXT,
    "umbral" TEXT,
    "hint"   TEXT,

    CONSTRAINT "AuditoriaCheck_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditoriaRun_ts_idx" ON "AuditoriaRun"("ts");
CREATE INDEX "AuditoriaCheck_run_id_idx" ON "AuditoriaCheck"("run_id");
-- Seguir un mismo chequeo a lo largo del tiempo: es la consulta del sparkline por chequeo.
CREATE INDEX "AuditoriaCheck_clave_id_idx" ON "AuditoriaCheck"("clave", "id");

-- ON DELETE CASCADE: borrar una corrida vieja se lleva sus chequeos. Sin esto, la poda del
-- historial dejaría filas huérfanas que nadie vuelve a mirar y siguen ocupando.
ALTER TABLE "AuditoriaCheck" ADD CONSTRAINT "AuditoriaCheck_run_id_fkey"
    FOREIGN KEY ("run_id") REFERENCES "AuditoriaRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
