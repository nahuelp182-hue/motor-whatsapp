import { prisma } from '@/lib/prisma'

// Datos vivos que algunos widgets necesitan de la base. Van resueltos en el servidor y
// viajan dentro de la misma respuesta de /api/widgets/config, así el sitio hace UNA sola
// petición y el widget no queda parpadeando mientras carga.
//
// Las reseñas salen de `Review` y son de tres fuentes, todas reales:
//   - whatsapp: respuesta del comprador a la plantilla post-entrega → "compra verificada".
//   - google:   reseña de la ficha de Google Business, traída por el cron (sello Google).
//   - form:     dejada desde el formulario público del sitio; NO se publica hasta aprobarla.
// Por eso solo viajan las aprobadas (`approved`), y el sello depende de la fuente.

export type ResenaPublica = {
  nombre: string
  texto: string
  fecha: string
  rating: number | null
  fuente: 'whatsapp' | 'google' | 'form'
  verificada: boolean
}

export type ResenasBloque = {
  items: ResenaPublica[]
  promedio: number | null // 4.9 — solo cuenta las que tienen estrellas
  total: number           // total de reseñas publicadas (con o sin estrellas)
}

/** Nombre de pila + inicial: "Laura G.". Publicar el apellido entero es PII innecesaria. */
function nombreCorto(completo: string): string {
  const partes = completo.trim().split(/\s+/)
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[1][0].toUpperCase()}.`
}

export async function resenasPublicas(storeId: string, cantidad: number): Promise<ResenasBloque> {
  // Orden por createdAt (siempre presente) y no por `fecha`: en Postgres, ORDER BY fecha
  // DESC pone los NULL primero, y como WhatsApp/formulario no traen `fecha`, las de Google
  // (que sí la traen) quedarían al fondo y podrían no entrar en el corte. Cuando el cron de
  // Google ingesta una reseña, le pone createdAt = fecha real de la reseña, así la mezcla
  // por recencia sigue siendo correcta.
  const filas = await prisma.review.findMany({
    where: { store_id: storeId, approved: true },
    orderBy: { createdAt: 'desc' },
    include: { customer: { select: { nombre: true } } },
  })

  // Una respuesta de dos palabras ("gracias", "ok") no construye confianza: ocupa lugar.
  const utiles = filas.filter(r => r.texto.trim().length >= 25)

  const conEstrella = utiles.filter(r => typeof r.rating === 'number')
  const promedio = conEstrella.length
    ? Math.round((conEstrella.reduce((s, r) => s + (r.rating ?? 0), 0) / conEstrella.length) * 10) / 10
    : null

  const items: ResenaPublica[] = utiles
    .slice(0, Math.min(30, Math.max(1, cantidad)))
    .map(r => {
      const fuente = (r.source as ResenaPublica['fuente']) ?? 'whatsapp'
      // El autor sale del Customer cuando existe; si no (Google/form), del campo `autor`.
      const nombre = r.customer?.nombre ? nombreCorto(r.customer.nombre) : (r.autor ?? 'Cliente')
      return {
        nombre,
        texto: r.texto.trim().slice(0, 600),
        fecha: (r.fecha ?? r.createdAt).toISOString().slice(0, 10),
        rating: typeof r.rating === 'number' ? r.rating : null,
        fuente,
        // Solo whatsapp y google son verificables como compra/reseña real de terceros.
        // Una del formulario público NO lleva sello aunque esté aprobada.
        verificada: fuente === 'whatsapp' || fuente === 'google',
      }
    })

  return { items, promedio, total: utiles.length }
}
