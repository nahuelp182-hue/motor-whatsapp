-- claude_usage pasa a cubrir TODO el gasto de IA, no solo el del bot.
--
-- Hasta ahora la tabla solo registraba las 4 rutas del motor (whatsapp, instagram, web,
-- web-cliente): USD 2,30 en un mes. Lo que NO se medía —vanguardia_diaria, radar_saas,
-- reddit_radar y geo_report— se estima en ~USD 18/mes. O sea que lo medido era la octava
-- parte de lo gastado, y la parte ciega es justo la que puede escalar sola: una corrida
-- que se pone a buscar de más no dispara ninguna alerta, porque el tope de gasto mira una
-- tabla donde esos scripts no escriben.
--
-- `web_search_requests` existe porque la búsqueda web se factura APARTE: USD 10 cada 1.000
-- búsquedas, además de los tokens que los resultados agregan al input. Los tres scripts
-- ciegos que usan Claude usan búsqueda web. Sin esta columna, instrumentarlos habría
-- seguido dejando invisible una parte del costo — midiendo mal, que es peor que no medir,
-- porque el número da aire de exactitud.
--
-- `provider` porque geo_report usa Gemini. Un panel que dice "gasto de IA" y solo muestra
-- Claude miente por omisión.

ALTER TABLE claude_usage ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'anthropic';
ALTER TABLE claude_usage ADD COLUMN IF NOT EXISTS web_search_requests INTEGER NOT NULL DEFAULT 0;
-- Cuánto duró la llamada: sirve para distinguir "gasta mucho" de "gasta muchas veces".
ALTER TABLE claude_usage ADD COLUMN IF NOT EXISTS duracion_ms INTEGER;

-- El ranking del panel agrupa por canal sobre una ventana de tiempo; hoy eso es un scan
-- completo. Con una fila por llamada de todos los consumidores, deja de serlo.
CREATE INDEX IF NOT EXISTS claude_usage_ts_channel_idx ON claude_usage (ts DESC, channel);
