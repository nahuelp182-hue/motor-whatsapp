CREATE TABLE IF NOT EXISTS "MlPregunta" (
    "question_id" TEXT NOT NULL,
    "item_id" TEXT,
    "item_titulo" TEXT,
    "comprador_id" TEXT,
    "comprador_nick" TEXT,
    "texto" TEXT NOT NULL,
    "respuesta" TEXT,
    "estado" TEXT NOT NULL,
    "motivo_bloqueo" TEXT,
    "intent" TEXT,
    "fecha_pregunta" TIMESTAMP(3) NOT NULL,
    "fecha_respuesta" TIMESTAMP(3),
    "actualizado" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MlPregunta_pkey" PRIMARY KEY ("question_id")
);

CREATE INDEX IF NOT EXISTS "MlPregunta_fecha_pregunta_idx" ON "MlPregunta"("fecha_pregunta");
CREATE INDEX IF NOT EXISTS "MlPregunta_estado_idx" ON "MlPregunta"("estado");
