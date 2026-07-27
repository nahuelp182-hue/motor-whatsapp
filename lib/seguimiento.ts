// Mensaje de seguimiento para un envío del que NO tenemos estado en vivo (todo lo que no
// es Andreani). Vive fuera de la ruta para poder probarlo: es el camino por el que el bot
// le afirma cosas al cliente sobre dónde está su paquete.

/** Lo único que hace falta para armar el mensaje. `Pedido` del webhook lo cumple. */
export type EnvioConsultado = {
  numero?: number
  tracking?: string
  correo?: string          // método de envío según Tiendanube ("Andreani a domicilio", "Punto de retiro"…)
  pickup?: boolean         // retira en un punto/sucursal en vez de recibirlo en el domicilio
  diasDesdeCompra?: number
}

// Días tras los cuales un despacho ya no se puede describir como "en viaje". Sin estado en
// vivo, lo único que tenemos es lo que Tiendanube anotó el día del despacho; pasado un mes
// y medio eso ya no dice dónde está el paquete, dice que salió.
//
// El 27/07/26 el bot le contestó a una clienta "tu pedido viaja por Punto de retiro,
// seguilo con este código" sobre un envío que Andreani tenía como ENTREGADO desde hacía
// catorce meses. Ese pedido entró por acá porque su método de envío no decía "andreani".
export const DIAS_ENVIO_VIEJO = 45

export function esEnvioViejo(dias?: number): boolean {
  return (dias ?? 0) > DIAS_ENVIO_VIEJO
}

// Página de seguimiento de Correo Argentino (la misma que declara la KB).
export const LINK_CORREO_ARGENTINO = 'https://www.correoargentino.com.ar/seguimiento-de-envios'

/**
 * Da el código y dónde consultarlo, sin afirmar ningún estado.
 * Devuelve null —y entonces el caller deriva a una persona— cuando no hay nada certero que
 * decir: sin número de seguimiento, o con un pedido tan viejo que "está en camino" sería
 * una afirmación sin respaldo.
 */
export function mensajeSeguimientoGenerico(pedido: EnvioConsultado): string | null {
  if (!pedido.tracking) return null
  if (esEnvioViejo(pedido.diasDesdeCompra)) return null

  const donde = pedido.pickup
    ? 'va al punto de retiro que elegiste 📦'
    : `viaja por ${pedido.correo || 'el correo'} 📦`
  return `Tu pedido #${pedido.numero} ${donde} ` +
    `Seguilo con este código: ${pedido.tracking}\n${LINK_CORREO_ARGENTINO}`
}
