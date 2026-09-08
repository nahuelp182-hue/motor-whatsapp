-- Fecha de ingreso al circuito de Andreani.
-- Parte el tiempo total en dos mitades con dueños distintos: compra->ingreso es armado y
-- despacho de Micelium; ingreso->entrega es el correo. Un promedio sin ese corte no dice a
-- quién hay que reclamarle.
ALTER TABLE "EnvioSeguimiento" ADD COLUMN "ingresado_at" TIMESTAMP(3);
