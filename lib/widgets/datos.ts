import { prisma } from '@/lib/prisma'

// Datos vivos que algunos widgets necesitan de la base. Van resueltos en el servidor y
// viajan dentro de la misma respuesta de /api/widgets/config, así el sitio hace UNA sola
// petición y el widget no queda parpadeando mientras carga.
//
// La reseña sale de `Review`: es la respuesta real de un comprador a la plantilla de
// post-entrega por WhatsApp. Por eso el sello de "compra verificada" es cierto y no un
// adorno — es la diferencia con cualquier app de reseñas cargadas a mano.

export type ResenaPublica = {
  nombre: string
  texto: string
  fecha: string
  verificada: boolean
}

/** Nombre de pila + inicial: "Laura G.". Publicar el apellido entero es PII innecesaria. */
function nombreCorto(completo: string): string {
  const partes = completo.trim().split(/\s+/)
  if (partes.length === 1) return partes[0]
  return `${partes[0]} ${partes[1][0].toUpperCase()}.`
}

export async function resenasPublicas(storeId: string, cantidad: number): Promise<ResenaPublica[]> {
  const filas = await prisma.review.findMany({
    where: { store_id: storeId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(30, Math.max(1, cantidad)),
    include: { customer: { select: { nombre: true } } },
  })

  return filas
    // Una respuesta de dos palabras ("gracias", "ok") no construye confianza: ocupa lugar.
    .filter(r => r.texto.trim().length >= 25)
    .map(r => ({
      nombre: nombreCorto(r.customer.nombre),
      texto: r.texto.trim().slice(0, 600),
      fecha: r.createdAt.toISOString().slice(0, 10),
      verificada: true,
    }))
}
