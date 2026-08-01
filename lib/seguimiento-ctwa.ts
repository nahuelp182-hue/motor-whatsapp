// Seguimiento de las conversaciones que nacieron de un anuncio click-to-WhatsApp.
//
// POR QUÉ ESTAS HORAS Y NO OTRAS
// Un anuncio CTWA abre una ventana de 72 h en la que TODOS los mensajes son gratis,
// plantillas incluidas. Y —esto es lo que la hace valiosa— esa ventana quedó EXPLÍCITAMENTE
// fuera del cambio de tarifas del 01/10/2026: lo que se empieza a cobrar ese día es la
// ventana de servicio de 24 h del tráfico orgánico, no esta.
//
// O sea que el seguimiento a un lead que vino de un anuncio es, hoy y después de octubre,
// el único reimpacto por WhatsApp que no cuesta un peso. Dos toques dentro de las 72 h:
// uno a las ~20 h (mismo día siguiente, todavía se acuerda) y otro a las ~48 h (última
// chance antes de que la ventana se cierre y cada mensaje pase a costar plantilla).
//
// A QUIÉN NO SE LE ESCRIBE
// Al que ya compró, al que ya está con una persona, y al que contestó después del último
// mensaje nuestro —ese está en conversación, no necesita que lo empujen—. Un seguimiento
// mal puesto en un producto de $288.000 no es un mensaje de más: es la diferencia entre
// parecer atento y parecer desesperado, y el freno #1 medido de esta marca es la
// desconfianza.
//
// El "ya compró" NO se resuelve acá: no hay ninguna marca de compra en ig_diag, y filtrar
// por una inventada da la ilusión de estar cubierto. Lo verifica el cron contra Tiendanube
// antes de mandar, que es donde vive el dato de verdad. Son 0-5 candidatos por corrida:
// una consulta por candidato no es un problema.

import { getPool } from '@/lib/diag'

/** Toques dentro de la ventana. Fuera de las 72 h no se manda nada: ahí ya se cobra. */
export const TOQUES = [
  { etapa: 'h20', desdeHoras: 20, hastaHoras: 30 },
  { etapa: 'h48', desdeHoras: 48, hastaHoras: 68 },
] as const

export type Etapa = (typeof TOQUES)[number]['etapa']

export type Candidato = {
  sender: string
  etapa: Etapa
  sourceId: string | null
  horas: number
}

/**
 * Mensajes por etapa. Cortos y sin presión: el segundo NO repite la oferta, ofrece la
 * salida humana, que es lo que la Biblioteca tiene medido como el foso —el 49% de los
 * mensajes de asesoría van a gente que todavía no compró—.
 */
export const MENSAJES: Record<Etapa, string> = {
  h20:
    'Hola 👋 Te escribo por lo que estabas viendo ayer. ' +
    '¿Te quedó alguna duda dando vueltas? Preguntame lo que sea, sin compromiso 🙌',
  h48:
    'Che, última por acá así no te molesto más 🙌 ' +
    'Si estás con la duda de si vas a poder, es la pregunta que más nos hacen y la respuesta corta es que sí: ' +
    'el equipo resuelve el ambiente y el resto lo vemos juntos. ' +
    'Si querés que te cuente cómo, escribime cuando puedas.',
}

/**
 * Conversaciones nacidas de un anuncio que están dentro de la ventana y todavía no
 * recibieron el toque de su etapa.
 *
 * Hoy devuelve vacío por construcción: no hay ninguna fila `ctwa_origen` porque todavía no
 * corrió ninguna campaña click-to-WhatsApp. Eso es a propósito — el cron puede quedar
 * instalado y programado sin que le escriba a nadie hasta que exista la campaña.
 */
export async function candidatos(): Promise<Candidato[]> {
  const pool = getPool()
  if (!pool) return []

  const out: Candidato[] = []
  for (const t of TOQUES) {
    const r = await pool.query(
      `
      SELECT o.sender,
             o.detail->>'source_id' AS source_id,
             EXTRACT(EPOCH FROM (now() - o.ts)) / 3600 AS horas
        FROM ig_diag o
       WHERE o.kind = 'ctwa_origen'
         AND o.ts BETWEEN now() - ($1 || ' hours')::interval
                      AND now() - ($2 || ' hours')::interval
         -- ya se le mandó el toque de esta etapa
         AND NOT EXISTS (
           SELECT 1 FROM ig_diag s
            WHERE s.sender = o.sender AND s.kind = 'ctwa_seguimiento'
              AND s.detail->>'etapa' = $3 AND s.ts > o.ts)
         -- está con una persona: el bot no se mete.
         -- OJO: no existe un kind 'derivado'. La derivación se marca sobre 'pensado' con
         -- detail->>'derivar' = 'true' —igual que ultimaDerivacion() en lib/diag.ts—. La
         -- primera versión de esta query filtraba por un kind inventado: no rompía nada,
         -- simplemente no excluía a nadie nunca. Un filtro que no filtra es peor que no
         -- tenerlo, porque parece que está.
         AND NOT EXISTS (
           SELECT 1 FROM ig_diag d
            WHERE d.sender = o.sender AND d.ts > o.ts
              AND (d.kind = 'handoff_activo'
                   OR (d.kind = 'pensado' AND d.detail->>'derivar' = 'true')))
         -- escribió después de nuestro último mensaje: está en conversación, no lo empujamos
         AND NOT EXISTS (
           SELECT 1 FROM ig_diag u
            WHERE u.sender = o.sender AND u.kind = 'recibido'
              AND u.ts > COALESCE(
                    (SELECT max(p.ts) FROM ig_diag p
                      WHERE p.sender = o.sender AND p.kind = 'pensado'), o.ts))
       ORDER BY o.ts
      `,
      [String(t.hastaHoras), String(t.desdeHoras), t.etapa],
    )
    for (const row of r.rows) {
      out.push({
        sender: row.sender,
        etapa: t.etapa,
        sourceId: row.source_id ?? null,
        horas: Number(row.horas),
      })
    }
  }
  return out
}
