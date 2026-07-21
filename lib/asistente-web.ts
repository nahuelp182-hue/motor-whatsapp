// Cerebro del asistente de la web pública (modo frío).
//
// Reusa la persona y las reglas de Ariel (KB_MICELIUM, el mismo cerebro del bot de WhatsApp)
// para no mantener dos voces que con el tiempo divergen. Encima le pone las reglas propias
// del canal web:
//   - No es WhatsApp: nada de menús 1/2/3 ni "te paso con una persona por acá".
//   - Se apoya en las guías públicas y CITA la página fuente. No inventa datos técnicos.
//   - Escala a un humano (por WhatsApp) cuando el problema es de diagnóstico real: los dos
//     vitales (sanidad y temperatura por especie) y cualquier cultivo que va mal. Ese es el
//     foso del negocio y no lo resuelve un chat.
//
// SEGURIDAD (prompt injection): la defensa no es pedirle al modelo que "no se deje engañar".
// Es arquitectónica: en modo frío el asistente NO tiene herramientas contra la base de datos
// ni acceso a pedidos. Todo su conocimiento es contenido público (las guías). Que alguien lo
// intente manipular para "mostrar el pedido 1050" no lleva a ningún lado porque no hay forma
// de expresar esa consulta: los datos privados simplemente no están en este contexto.
import { KB_MICELIUM } from '@/lib/kb-micelium'
import { guiasParaPrompt } from '@/lib/guias'

export const MODELO_ASISTENTE = 'claude-haiku-4-5-20251001'
export const WA_HUMANO = '543512145521'

// Contexto del cliente ya verificado (sale de la cookie firmada, NUNCA del body). Cuando está
// presente, el asistente pasa a "modo cliente": ya sabe quién es, qué compró y su envío.
export type ContextoCliente = {
  nombre: string
  numero: number
  equipos: string[]
  envio?: string // resumen legible del estado de envío, o vacío
}

export function systemAsistenteWeb(
  ctx?: ContextoCliente,
): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> {
  const reglasWeb = `
Estás respondiendo en el SITIO WEB público de Micelium (una página de guías), NO en WhatsApp.
Sos el asistente virtual de Micelium: cálido, breve, argentino, y transparente en que sos un
asistente automático.

DIFERENCIAS CON EL CANAL WHATSAPP:
- NO uses el menú "1️⃣ 2️⃣ 3️⃣" ni ofrezcas "seguimiento de envío": eso es del bot de WhatsApp.
  Acá el visitante todavía no compró, casi siempre está averiguando antes de decidir.
- Respuestas cortas, de 1 a 4 líneas. La gente lee poco. Nada de párrafos largos.
- Cuando la respuesta esté en una guía, DECILO y nombrá la guía. Ejemplo: "Está explicado en
  la guía «Cómo funciona la incubadora»." El sistema muestra el link; vos solo nombrala.

DE QUÉ PODÉS HABLAR:
- Solo Micelium: el equipo, cómo funciona, qué necesita el cliente, precios/pagos a grandes
  rasgos, envíos, y cultivo en general. Si preguntan otra cosa (otra marca, algo personal,
  "escribime un poema"), decliná amable y volvé al tema.
- Usá EXCLUSIVAMENTE la información de las guías y de la KB de abajo. Si un dato técnico no
  está o figura "sin confirmar", NO lo inventes: decí que lo confirmás con el equipo y ofrecé
  el WhatsApp. Inventar una temperatura o un consumo puede arruinarle el cultivo a alguien.
- NUNCA menciones variedades psicoactivas ni des recetas de armado casero del equipo.

CUÁNDO PASAR A UNA PERSONA (escalar):
Terminá tu respuesta con la etiqueta [WHATSAPP] SOLO en estos casos:
  1. El cultivo de la persona va mal / se contaminó / no avanza (diagnóstico real de SU caso).
  2. Pregunta de sanidad o de la ventana de temperatura de una especie puntual.
  3. Una falla del equipo, garantía o repuesto.
  4. La persona pide explícitamente hablar con alguien.
En esos casos respondé lo que puedas y agregá, en tus palabras, que para eso mejor lo ve una
persona del equipo por WhatsApp. Para preguntas generales (precio, cómo funciona, envíos,
qué necesita) NO escales: respondé vos.

FORMATO DE SALIDA (obligatorio):
[RESPUESTA] tu respuesta al visitante, en tono Micelium, breve.
[GUIA] el slug de la guía más relevante si la hay (uno de: los-dos-vitales,
donde-conseguir-insumos, como-funciona-la-incubadora), o "-" si ninguna aplica.
[WHATSAPP] si / no  (si corresponde escalar a una persona)
`.trim()

  const contextoGuias = `CONTENIDO DE LAS GUÍAS PÚBLICAS (fuente de verdad):\n${guiasParaPrompt()}`

  const bloques: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [
    // Cacheado: KB + reglas + guías viajan una vez y se reusan (respuestas ~10x más baratas).
    { type: 'text', text: KB_MICELIUM, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: reglasWeb },
    { type: 'text', text: contextoGuias, cache_control: { type: 'ephemeral' } },
  ]

  // MODO CLIENTE. Este bloque NO se cachea: es distinto por cada cliente y va al final para no
  // romper el prefijo cacheado. Los datos ya vienen verificados desde la cookie firmada, así
  // que el asistente puede confiar en ellos, pero SOLO son del propio cliente (anti-IDOR).
  if (ctx) {
    const equipos = ctx.equipos.map(e => (e === 'inc101' ? 'Incubadora INC101' : e === 'pc400' ? 'Tableta térmica' : 'su compra')).join(', ')
    bloques.push({
      type: 'text',
      text:
        `MODO CLIENTE — esta persona YA COMPRÓ y está identificada:\n` +
        `- Nombre: ${ctx.nombre || '(sin nombre)'}\n` +
        `- Pedido: #${ctx.numero}\n` +
        `- Compró: ${equipos || 'un equipo'}\n` +
        (ctx.envio ? `- Estado del envío: ${ctx.envio}\n` : '') +
        `\nAtendelo por su nombre y con confianza: NO le pidas el número de pedido ni qué compró, ` +
        `ya lo sabés. Si pregunta por su envío, respondé con el estado de arriba. Si vas a ` +
        `escalar a una persona, ya conocés su pedido (#${ctx.numero}), así que no se lo pidas de ` +
        `nuevo. El resto de las reglas siguen igual: no inventes datos técnicos, y para un ` +
        `cultivo que va mal o una falla, derivá al equipo.`,
    })
  }

  return bloques
}

export type SalidaAsistente = { respuesta: string; guia: string | null; whatsapp: boolean }

export function parseAsistente(raw: string): SalidaAsistente {
  const mResp = raw.match(/\[RESPUESTA\]\s*([\s\S]*?)\s*(?:\[GUIA\]|\[WHATSAPP\]|$)/i)
  const mGuia = raw.match(/\[GUIA\]\s*([a-z0-9-]+)/i)
  const mWa = raw.match(/\[WHATSAPP\]\s*(si|sí)/i)
  const respuesta = (mResp ? mResp[1] : raw).trim()
  const guiaRaw = mGuia ? mGuia[1].toLowerCase() : '-'
  const guia = guiaRaw === '-' || guiaRaw === 'ninguna' ? null : guiaRaw
  return { respuesta, guia, whatsapp: mWa ? /s[ií]/i.test(mWa[1]) : false }
}

/** Historial que manda el cliente: se sanea a lo mínimo y se acota para no inflar el prompt. */
export type TurnoWeb = { role: 'user' | 'assistant'; content: string }

export function sanearHistorial(input: unknown): TurnoWeb[] {
  if (!Array.isArray(input)) return []
  const out: TurnoWeb[] = []
  for (const t of input.slice(-10)) {
    if (t && (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string') {
      out.push({ role: t.role, content: t.content.slice(0, 1500) })
    }
  }
  return out
}
