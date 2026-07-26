// Validación de negocio del panel — additiva, NO bloqueante.
//
// El servidor ya sanea todo con sanearConfig(): garantiza que la config es del tipo correcto
// y que nada de lo que se guarda puede romper el sitio. Esto es otra cosa: avisa de lo que es
// técnicamente válido pero casi seguro un error de carga —un WhatsApp de seis dígitos, una
// cuenta regresiva con fecha ya pasada, un "envío gratis" configurado en $0—. Son avisos
// arriba del formulario; nunca impiden guardar, porque la decisión final es de quien edita.
//
// Igual que todo el motor, esto se apoya en el contrato (lib/widgets/tipos.ts): las reglas se
// escriben por slug, y un widget sin reglas propias simplemente no tiene avisos. Se usa Zod
// para los chequeos de formato, que es donde un esquema declarativo se lee mejor que un if.

import { z } from 'zod'
import type { TipoWidget } from './tipos'

export type NivelAviso = 'error' | 'aviso'
export type Aviso = {
  /** Campo al que apunta, para poder resaltarlo. Vacío = aviso del widget entero. */
  key?: string
  nivel: NivelAviso
  mensaje: string
}

type Config = Record<string, unknown>
type Regla = (c: Config, tipo: TipoWidget) => Aviso[]

// ── Ayudas de lectura ──────────────────────────────────────────────────────────
const txt = (v: unknown) => String(v ?? '').trim()
const num = (v: unknown) => Number(v ?? 0)
const lista = (v: unknown) => (Array.isArray(v) ? (v as Config[]) : [])

// Formatos, con Zod. safeParse evita el try/catch y deja el mensaje al lado de la regla.
const esWhatsApp = z.string().regex(/^\d{10,15}$/) // país + área + número, sin + ni espacios
const idYouTube = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/

// ── Reglas por tipo de widget ────────────────────────────────────────────────
// Solo lo que un saneo no puede saber: si el dato es coherente con lo que el widget promete.
const REGLAS: Record<string, Regla> = {
  whatsapp_flotante(c) {
    const n = txt(c.numero)
    if (!n) return [{ key: 'numero', nivel: 'error', mensaje: 'Falta el número de WhatsApp: sin él el botón no abre ningún chat.' }]
    if (!esWhatsApp.safeParse(n).success)
      return [{ key: 'numero', nivel: 'error', mensaje: 'El número parece incompleto. Va con código de país y área, sin + ni espacios: por ejemplo 5493512145521.' }]
    return []
  },

  video(c) {
    const y = txt(c.youtube)
    if (!y) return [{ key: 'youtube', nivel: 'error', mensaje: 'Falta la dirección del video: sin ella el widget no dibuja nada.' }]
    if (!idYouTube.test(y))
      return [{ key: 'youtube', nivel: 'error', mensaje: 'No se reconoce un video de YouTube en esa dirección. Pegá la que copiás desde YouTube (larga o youtu.be/…).' }]
    return []
  },

  cuenta_regresiva(c) {
    const s = txt(c.hasta)
    if (!s) return [{ key: 'hasta', nivel: 'error', mensaje: 'Falta la fecha de cierre: sin fecha el reloj no aparece.' }]
    const t = Date.parse(s.replace(' ', 'T'))
    if (Number.isNaN(t)) return [{ key: 'hasta', nivel: 'error', mensaje: 'La fecha no se entiende. Va como año-mes-día y hora, por ejemplo 2026-08-15 23:59.' }]
    if (t <= Date.now()) return [{ key: 'hasta', nivel: 'aviso', mensaje: 'Esa fecha ya pasó: el reloj no se va a mostrar. Poné una fecha futura.' }]
    return []
  },

  corte_despacho(c) {
    const avisos: Aviso[] = []
    const claves = ['dia_lun', 'dia_mar', 'dia_mie', 'dia_jue', 'dia_vie', 'dia_sab', 'dia_dom']
    const cuantos = claves.filter(k => c[k]).length
    if (!cuantos)
      return [{ nivel: 'error', mensaje: 'No marcaste ningún día de despacho: sin días el widget no se muestra.' }]

    // Con pocos días de despacho, la mayor parte de la semana el mensaje pasa a ser "sale
    // el martes" — o sea, el widget le anuncia una demora a quien estaba por comprar.
    if (cuantos <= 2)
      avisos.push({
        nivel: 'aviso',
        mensaje: `Con ${cuantos} día${cuantos > 1 ? 's' : ''} de despacho, buena parte de la semana el cartel va a decir «sale el …» en vez de «sale hoy». Sobre el historial de INC101, dos días por semana dejan al 50 % de las compras leyendo una espera de 3 o 4 días.`,
      })

    const h = num(c.hora_corte)
    if (h < 8 || h > 20)
      avisos.push({
        key: 'hora_corte',
        nivel: 'aviso',
        mensaje: 'La hora de corte está fuera del horario de trabajo. Es hora de Argentina y en punto: 14 son las dos de la tarde.',
      })

    // Un corte muy temprano manda a "sale mañana" casi todas las visitas del día.
    if (h > 0 && h <= 10)
      avisos.push({
        key: 'hora_corte',
        nivel: 'aviso',
        mensaje: 'Un corte tan temprano deja casi todas las visitas del día leyendo «sale mañana». Cuanto más tarde sea el corte, más gente ve «sale hoy» — mientras puedas cumplirlo.',
      })

    // El widget promete una fecha; en feriado no hay despacho y la promesa se rompe.
    const feriados = txt(c.feriados)
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(Boolean)
    if (!feriados.length)
      avisos.push({
        key: 'feriados',
        nivel: 'aviso',
        mensaje: 'No hay feriados cargados. En un feriado el widget va a decir «sale hoy» con el depósito cerrado, y eso el cliente lo ve en el seguimiento de Andreani.',
      })
    else if (feriados.some(f => !/^\d{4}-\d{2}-\d{2}$/.test(f)))
      avisos.push({
        key: 'feriados',
        nivel: 'error',
        mensaje: 'Hay líneas que no son fechas válidas y se van a ignorar. Va una por línea, como año-mes-día: 2026-08-17.',
      })

    return avisos
  },

  progreso_envio(c) {
    if (num(c.objetivo) <= 0)
      return [{ key: 'objetivo', nivel: 'error', mensaje: 'El monto para envío gratis está en $0: con eso el widget no se muestra. Poné el mismo monto que tenés configurado en Tiendanube.' }]
    return []
  },

  banner_anuncio(c) {
    const msgs = lista(c.items).filter(i => txt(i.texto))
    if (!msgs.length) return [{ key: 'items', nivel: 'error', mensaje: 'No hay ningún mensaje cargado: la barra no va a aparecer.' }]
    return []
  },

  captura_email(c) {
    // En modo ventana, una demora muy corta interrumpe a alguien que todavía no leyó nada.
    if (c.modo !== 'bloque' && num(c.demora) > 0 && num(c.demora) < 8)
      return [{ key: 'demora', nivel: 'aviso', mensaje: 'Menos de 8 segundos la ventana salta antes de que la persona lea nada. Suele rendir más entre 12 y 20.' }]
    return []
  },

  carrusel(c) {
    const avisos: Aviso[] = []
    const imgs = lista(c.items).filter(i => txt(i.archivo))
    if (!imgs.length)
      return [{ key: 'items', nivel: 'error', mensaje: 'No hay ninguna imagen cargada: el carrusel no va a aparecer.' }]

    // Con una sola tarjeta no hay carrusel: hay una imagen, y para eso está el widget de
    // imagen suelta, que no arrastra flechas ni puntos que no llevan a ninguna parte.
    if (imgs.length === 1)
      avisos.push({ key: 'items', nivel: 'aviso', mensaje: 'Con una sola imagen no hay nada que pasar. Para una imagen conviene el widget «Imagen o animación»: pesa menos y no muestra controles que no hacen nada.' })

    // Recortar una captura se lleva justo los renglones de arriba y de abajo.
    if (c.ajuste === 'recortada')
      avisos.push({ key: 'ajuste', nivel: 'aviso', mensaje: 'Con «Recortada al centro», una captura de pantalla pierde el principio y el final del mensaje, que es lo que se quería mostrar. Para capturas va «Entera, sin recortar».' })

    const sinTexto = imgs.filter(i => !txt(i.alt) && !txt(i.titulo)).length
    if (sinTexto)
      avisos.push({ key: 'items', nivel: 'aviso', mensaje: `${sinTexto} imagen${sinTexto > 1 ? 'es' : ''} sin descripción ni título. Los buscadores y los lectores de pantalla no ven la imagen: sin texto, para ellos el bloque está vacío.` })

    if (num(c.por_vista) > 1 && imgs.length <= num(c.por_vista))
      avisos.push({ key: 'por_vista', nivel: 'aviso', mensaje: 'Entran todas a la vez en pantalla grande, así que ahí no queda nada para pasar. Sumá más imágenes o bajá cuántas se ven a la vez.' })

    return avisos
  },

  antes_despues(c) {
    const avisos: Aviso[] = []
    if (!txt(c.antes) || !txt(c.despues))
      return [{ nivel: 'error', mensaje: 'Faltan las dos imágenes: con una sola no hay comparación y el widget no se muestra.' }]
    if (txt(c.antes) === txt(c.despues))
      avisos.push({ nivel: 'error', mensaje: 'Las dos imágenes son el mismo archivo: arrastrar la manija no va a mostrar ningún cambio.' })
    if (!txt(c.pie))
      avisos.push({ key: 'pie', nivel: 'aviso', mensaje: 'Sin un pie que diga cuándo y dónde se sacaron, la comparación se lee como un montaje. El contexto es lo que la vuelve creíble.' })
    return avisos
  },

  pack_complementarios: sinProductos,
  upsell_upgrade: sinProductos,
  upsell_al_agregar: sinProductos,
  crosssell_carrito: sinProductos,
}

// Varios widgets se apoyan en productos del catálogo: sin ninguno elegido, no dibujan nada.
function sinProductos(c: Config, tipo: TipoWidget): Aviso[] {
  let hayCampoProducto = false
  let hayValor = false
  for (const campo of tipo.campos) {
    if (campo.tipo === 'producto') {
      hayCampoProducto = true
      if (txt(c[campo.key])) hayValor = true
    } else if (campo.tipo === 'lista') {
      for (const item of lista(c[campo.key])) {
        for (const sub of campo.campos ?? []) {
          if (sub.tipo !== 'producto') continue
          hayCampoProducto = true
          if (txt(item[sub.key])) hayValor = true
        }
      }
    }
  }
  if (hayCampoProducto && !hayValor)
    return [{ nivel: 'error', mensaje: 'Todavía no elegiste ningún producto del catálogo: así el widget no aparece en el sitio.' }]
  return []
}

/**
 * Avisos de una config, ordenados con los errores primero. Vacío = todo en orden.
 * No bloquea nada: es información para quien edita, no una traba.
 */
export function validarConfig(tipo: TipoWidget, config: Config): Aviso[] {
  const regla = REGLAS[tipo.slug]
  const avisos = regla ? regla(config, tipo) : []
  return avisos.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === 'error' ? -1 : 1))
}
