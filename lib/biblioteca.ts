// Biblioteca digital del cliente.
//
// Es lo que convierte una venta de e-book en una relación: el material no se "entrega" una
// vez por mail y se pierde, vive en la cuenta y se actualiza. Ese acceso permanente es
// también lo que sostiene el precio — es la diferencia entre vender un PDF y vender el
// acceso a algo que se mantiene.
//
// CÓMO SUMAR UN TÍTULO: dejá el PDF en `public/biblioteca/<archivo>.pdf` y agregá la entrada
// acá. Mientras `archivo` sea null, el portal muestra el título y ofrece pedirlo por
// WhatsApp: nunca un enlace roto.
//
// OJO: estos PDF quedan servidos por URL directa. No poner acá nada que no pueda circular
// si alguien comparte el enlace.

export type ItemBiblioteca = {
  id: string
  titulo: string
  descripcion: string
  /** Ruta pública del PDF, o null si todavía no está cargado. */
  archivo: string | null
  /** Si es true, lo ve cualquier cliente. Si no, solo quien compró material digital. */
  incluidoSiempre?: boolean
}

export const BIBLIOTECA: ItemBiblioteca[] = [
  {
    id: 'primer-cultivo',
    titulo: 'Guía del primer cultivo',
    descripcion:
      'El recorrido completo del primer ciclo, de la preparación a la cosecha. Es la que ' +
      'entregamos también a quien todavía no compró: acá la tenés siempre a mano.',
    archivo: '/guia-primer-cultivo.pdf',
    incluidoSiempre: true,
  },
  // Los títulos comprados van acá. Ejemplo del formato, con el archivo pendiente de cargar:
  // {
  //   id: 'manual-cultivo-avanzado',
  //   titulo: 'Cultivo avanzado',
  //   descripcion: 'Segunda y tercera oleada, rehidratación y manejo de sustrato agotado.',
  //   archivo: '/biblioteca/cultivo-avanzado.pdf',
  // },
]

/** Lo que le corresponde ver a este cliente. */
export function bibliotecaDe(equipos: string[]): ItemBiblioteca[] {
  const compróDigital = equipos.includes('ebook')
  return BIBLIOTECA.filter(i => i.incluidoSiempre || compróDigital)
}
