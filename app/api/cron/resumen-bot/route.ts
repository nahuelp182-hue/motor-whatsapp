import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { notifyNahuel } from '@/lib/notify'
import { chequearCron } from '@/lib/cron-auth'
import { marcarHeartbeat, chequearHeartbeats } from '@/lib/cron-heartbeat'
import { resumenCola, MAX_INTENTOS } from '@/lib/cola-envios'
import { gastoClaude24h, saludDelMostrador24h } from '@/lib/diag'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Buckets de tema por palabras clave (sobre los mensajes del cliente).
const TEMAS: Array<{ nombre: string; re: RegExp }> = [
  { nombre: 'Precio/compra', re: /precio|cuánto|cuanto|sale|vale|cuesta|comprar|cuota|transferencia|pago/i },
  { nombre: 'Envío', re: /envío|envio|seguimiento|correo|andreani|llega|despacho|tracking|demora/i },
  { nombre: 'Manual/uso', re: /manual|guía|guia|instructivo|cómo se usa|como se usa|material|pdf/i },
  { nombre: 'Cultivo', re: /cultiv|micelio|sustrato|gírgola|girgola|shiitake|reishi|melena|cordyceps|contamin|temperatura|humedad/i },
  { nombre: 'Problema/garantía', re: /roto|rota|no anda|no funciona|falla|garantía|garantia|reclamo|reembolso|devolución|devolucion/i },
  { nombre: 'Saludo', re: /^(hola|buenas|buen día|buen dia|buenos días|buenas tardes|holis)\b/i },
]

function clasificar(texto: string): string {
  for (const t of TEMAS) if (t.re.test(texto)) return t.nombre
  return 'Otros'
}

export async function GET(req: NextRequest) {
  const noAuth = chequearCron(req)
  if (noAuth) return noAuth

  const p = getPool()
  if (!p) return NextResponse.json({ ok: false, error: 'DB no configurada' })

  try {
    const rows = (await p.query(
      `SELECT ts, kind, sender, detail
         FROM ig_diag
        WHERE canal = 'wa'
          AND kind IN ('recibido','pensado','wa_send_fail','wa_error')
          AND ts > now() - interval '24 hours'
        ORDER BY id ASC`,
    )).rows as Array<{ ts: string; kind: string; sender: string; detail: unknown }>

    const senders = new Set<string>()
    let entrantes = 0
    let respuestas = 0
    let derivadas = 0
    let manuales = 0
    let errores = 0
    const temas = new Map<string, number>()

    for (const r of rows) {
      const d = (typeof r.detail === 'string' ? JSON.parse(r.detail) : r.detail) as Record<string, unknown>
      senders.add(r.sender)
      if (r.kind === 'recibido') {
        entrantes++
        const tema = clasificar(String(d.texto ?? ''))
        temas.set(tema, (temas.get(tema) ?? 0) + 1)
      } else if (r.kind === 'pensado') {
        respuestas++
        if (d.derivar === true) derivadas++
        if (typeof d.accion === 'string' && d.accion === 'manual_enviado') manuales++
      } else if (r.kind === 'wa_send_fail' || r.kind === 'wa_error') {
        errores++
      }
    }

    const topTemas = [...temas.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nombre, n]) => `  • ${nombre}: ${n}`)
      .join('\n')

    // ── Salud del mostrador: ¿el bot SIRVE? ──────────────────────────────────────────
    // Las alertas de más abajo miran la máquina (errores de envío, cola, crons, gasto).
    // Ninguna mira la ATENCIÓN: un bot que deriva todo y deja a la gente esperando las pasa
    // todas en verde. Pasó el 19/08/2026 —un cliente terminó anunciando una denuncia en
    // Defensa del Consumidor— sin que se encendiera una sola luz. Ver saludDelMostrador24h.
    let lineasSalud = ''
    try {
      const salud = await saludDelMostrador24h()
      if (salud && salud.derivados + salud.resueltos > 0) {
        const total = salud.derivados + salud.resueltos
        const pctDeriva = Math.round((salud.derivados / total) * 100)
        lineasSalud = [
          '',
          '🧭 Atención:',
          `  • Resueltos por el bot: ${salud.resueltos} (${100 - pctDeriva}%)`,
          `  • Derivados a una persona: ${salud.derivados} (${pctDeriva}%)`,
          ...(salud.patinaron ? [`  • Cortados por no resolver: ${salud.patinaron}`] : []),
          ...(salud.sinAtender ? [`  • ⚠️ Siguieron escribiendo tras derivar: ${salud.sinAtender}`] : []),
          '',
        ].join('\n')

        // Alerta aparte: alguien insistió DESPUÉS de que lo derivamos. Es la única huella
        // que queda de un cliente sin atender — las respuestas de Mateo salen de su teléfono
        // y no se loguean en ningún lado (bridge bloqueado por WhatsApp, confirmado 20/08).
        if (salud.sinAtender > 0) {
          await notifyNahuel(
            `🚨 ${salud.sinAtender} cliente(s) siguieron escribiendo tras ser derivados`,
            `En las últimas 24 h, ${salud.sinAtender} de ${salud.derivados} personas derivadas ` +
            `volvieron a escribir DESPUÉS del handoff: el bot ya no les responde, así que le ` +
            `insistieron a un chat en silencio.\n\n` +
            `La que más esperó llevaba ${salud.esperaMaxHoras} h insistiendo.\n\n` +
            `Esto no prueba que nadie las haya atendido (las respuestas desde el teléfono no ` +
            `quedan registradas), pero es la única señal disponible: alguien ya derivado que ` +
            `vuelve a escribir, no obtuvo respuesta cuando escribió.\n\n` +
            `Ver los hilos: https://mw-micelium.vercel.app/conversaciones`,
          )
        }
      }
    } catch (e) {
      console.error('[resumen-bot] salud del mostrador falló:', e)
    }


    const hayActividad = entrantes > 0
    const body =
      `Resumen últimas 24 h del asistente virtual (WhatsApp):\n\n` +
      `👥 Chats atendidos: ${senders.size}\n` +
      `💬 Mensajes entrantes: ${entrantes}\n` +
      `🤖 Respuestas del bot: ${respuestas}\n` +
      `➡️ Derivados a Mateo: ${derivadas}\n` +
      `📚 Manuales enviados: ${manuales}\n` +
      (errores ? `⚠️ Errores de envío: ${errores}\n` : '') +
      lineasSalud +
      (topTemas ? `\nTemas:\n${topTemas}\n` : '') +
      `\nVer conversaciones completas:\nhttps://mw-micelium.vercel.app/conversaciones`

    // Sin actividad → no molestar con un mail vacío.
    if (hayActividad) {
      await notifyNahuel('🍄 Resumen diario del bot (WhatsApp)', body)
    }

    // ── Tasa de error del bot ─────────────────────────────────────────────────────────
    // "⚠️ Errores de envío" ya salía en el resumen de arriba, pero como una línea más
    // entre varias — nadie la lee como alarma. El 12-18/08/2026 el crédito de Claude se
    // agotó y 49 de 89 mensajes (55%) fallaron durante 6 días sin que este cron dijera
    // nada aparte: el número estaba, pero enterrado. Esto dispara aparte, con umbral,
    // cuando la proporción de errores es alta — no solo cuando hay error.
    try {
      const UMBRAL_TASA_ERROR = 0.2 // 20%: un puñado de fallos sueltos no dispara, una fuga sí
      const tasaError = entrantes > 0 ? errores / entrantes : 0
      if (entrantes >= 5 && tasaError > UMBRAL_TASA_ERROR) {
        await notifyNahuel(
          '🚨 El bot de WhatsApp está fallando mucho',
          `De ${entrantes} mensajes recibidos en las últimas 24 h, ${errores} fallaron ` +
          `(${Math.round(tasaError * 100)}%).\n\n` +
          `Causa más común: crédito de la API de Claude agotado (mensaje "credit balance ` +
          `too low"). Revisar console.anthropic.com → Billing de la organización de ` +
          `mw-micelium.\n\n` +
          `Mientras tanto el bot deriva al equipo en cada falla — no se pierde el ` +
          `mensaje, pero tampoco responde solo.`,
        )
      }
    } catch (e) {
      console.error('[resumen-bot] chequeo de tasa de error falló:', e)
    }

    // ── Heartbeat de los otros crons (VPS + Vercel) ──────────────────────────────────
    // Va acá y no en un cron propio: mientras no esté confirmado el plan de Vercel, un
    // cron nuevo podría no correr nunca. Este SÍ corre (es el que acaba de mandar este
    // mismo mail), así que es el lugar más confiable para avisar. Dispara SIEMPRE que
    // haya algo vencido, actividad del bot o no — un cron caído importa más que un día
    // sin mensajes.
    // ── Estado de la cola de envíos ──────────────────────────────────────────────────
    // Un mensaje que agotó sus intentos queda FAILED y no vuelve a salir. El dashboard no
    // los dibuja en ninguna parte, así que sin este aviso nadie se entera de que el
    // recupero de carrito dejó de llegarle a alguien.
    try {
      const cola = await resumenCola()
      const atrasada = cola.masViejoHoras !== null && cola.masViejoHoras > 3
      if (cola.agotados24h > 0 || atrasada) {
        const lineas = [
          `Pendientes en cola: ${cola.pendientes}`,
          `Agotados (últimas 24 h): ${cola.agotados24h}`,
          cola.masViejoHoras !== null
            ? `El más viejo espera hace ${cola.masViejoHoras} h`
            : null,
        ].filter(Boolean).join('\n')
        await notifyNahuel(
          '⚠️ Cola de envíos con problemas',
          `${lineas}\n\n` +
          `"Agotados" son mensajes que se intentaron ${MAX_INTENTOS} veces y ya no se reintentan más: ` +
          `a esos clientes no les llegó el recupero de carrito.`,
        )
      }
    } catch (e) {
      console.error('[resumen-bot] resumen de cola falló:', e)
    }

    // ── Gasto de Claude ──────────────────────────────────────────────────────────────
    // Los topes de /api/asistente cuentan requests, no dólares: una conversación larga
    // cuesta varias veces lo que una pregunta suelta, así que el volumen puede parecer
    // normal mientras el costo se dispara.
    //
    // El tope está calibrado contra el gasto REAL medido el 27/07/2026: USD 2,02 en 30 días
    // (~0,07/día) sobre 199 llamadas. Un tope de 1 USD/día deja margen de ~15× sobre lo
    // normal: no dispara por un día movido, sí dispara ante una fuga.
    //
    // El valor anterior (5) estaba puesto a ojo y era ~75× el gasto real: no habría avisado
    // nunca. Un umbral que nunca dispara es tan inútil como no tenerlo, y uno que dispara
    // todos los días se vuelve ruido y arrastra a las otras alertas.
    try {
      const tope = Number(process.env.CLAUDE_TOPE_USD_DIA ?? 1)
      const gasto = await gastoClaude24h()
      if (gasto && gasto.total > tope) {
        const detalle = Object.entries(gasto.porCanal)
          .sort((a, b) => b[1] - a[1])
          .map(([canal, usd]) => `  • ${canal}: USD ${usd.toFixed(2)}`)
          .join('\n')
        await notifyNahuel(
          '💸 Gasto de Claude por encima del tope',
          `Últimas 24 h: USD ${gasto.total.toFixed(2)} (tope: USD ${tope.toFixed(2)})\n\n` +
          `${detalle}\n\n` +
          `El tope se ajusta con la variable CLAUDE_TOPE_USD_DIA.`,
        )
      }
    } catch (e) {
      console.error('[resumen-bot] chequeo de gasto falló:', e)
    }

    try {
      const vencidos = await chequearHeartbeats()
      if (vencidos.length > 0) {
        const detalle = vencidos
          .map((v) => v.horasSinCorrer === null
            ? `  • ${v.nombre}: nunca reportó`
            : `  • ${v.nombre}: sin correr hace ${v.horasSinCorrer} h${v.last_ok ? '' : ' (última corrida falló)'}`)
          .join('\n')
        await notifyNahuel(
          '⚠️ Crons sin reportar',
          `Estos crons no marcaron su corrida a tiempo — el VPS puede estar caído, o algo ` +
          `está rompiendo el bloque intermedio:\n\n${detalle}`,
        )
      }
    } catch (e) {
      console.error('[resumen-bot] chequeo de heartbeats falló:', e)
    }

    await marcarHeartbeat('resumen-bot', true)
    return NextResponse.json({
      ok: true,
      enviado: hayActividad,
      totales: { chats: senders.size, entrantes, respuestas, derivadas, manuales, errores },
    })
  } catch (e) {
    await marcarHeartbeat('resumen-bot', false, String(e).slice(0, 300))
    return NextResponse.json({ ok: false, error: String(e).slice(0, 300) })
  }
}
