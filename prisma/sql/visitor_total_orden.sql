-- Aditivo y seguro: agrega el total de la orden cosida a Visitor.
-- La API de TN ya lo trae en el mismo payload que curiosos_cosido.py pide (fields=...,total)
-- y hasta ahora lo descartaba. Sin esto no se puede calcular el valor monetario real
-- movido por widget, solo el proxy de WidgetEvent.meta.valor.

ALTER TABLE "Visitor" ADD COLUMN IF NOT EXISTS "total_orden" DECIMAL(10,2);
