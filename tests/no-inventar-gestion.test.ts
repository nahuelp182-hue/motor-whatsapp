import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { KB_MICELIUM } from '@/lib/kb-micelium'

// El 19/08/2026 el bot le dijo DOS VECES al mismo cliente que ya había abierto un reclamo
// en Andreani, con número de caso "CAS-2024XXXXX". Ese reclamo no existía y el bot no tiene
// herramienta para abrirlo. El cliente respondió "Mentira. Eso después no pasa" y anunció
// una denuncia en Defensa del Consumidor.
//
// La causa no fue una alucinación libre: la KB LE ORDENABA hacerlo ("4. Hacer un reclamo en
// Andreani y compartir los datos del caso (N° de caso CAS-...)"). Los 8 guardrails de "no
// inventar" que ya existían no podían ganarle a una instrucción explícita.
//
// REGLA GENERAL que este test defiende: si un paso de la KB describe una acción que el bot
// no puede ejecutar con una herramienta, ese paso es una DERIVACIÓN, no una instrucción.
const promptWebhook = fs.readFileSync(
  path.join(process.cwd(), 'app/api/webhooks/whatsapp/route.ts'),
  'utf-8',
)

describe('no anunciar gestiones que el bot no puede hacer', () => {
  it('la KB ya no ordena abrir un reclamo ni compartir un N° de caso', () => {
    expect(KB_MICELIUM).not.toContain('**Hacer un reclamo en Andreani** y compartir los datos del caso')
    expect(KB_MICELIUM).not.toContain('N° de caso CAS-...')
  })

  it('la KB dice explícitamente que el reclamo lo abre una persona, no el asistente', () => {
    expect(KB_MICELIUM).toContain('lo abre una PERSONA del equipo')
    expect(KB_MICELIUM).toContain('NUNCA dar un N° de caso')
  })

  it('la KB no sugiere anunciar un reclamo como ya hecho', () => {
    // "ahora mismo hago un reclamo" y "explicar que ya se hizo el reclamo" eran las otras
    // dos puertas al mismo error.
    expect(KB_MICELIUM).not.toContain('ahora mismo hago un reclamo')
    expect(KB_MICELIUM).not.toContain('explicar que ya se hizo el reclamo')
  })

  it('el prompt del webhook prohíbe dar un número de caso', () => {
    expect(promptWebhook).toContain('NUNCA ANUNCIES UNA GESTIÓN QUE NO HICISTE')
    expect(promptWebhook).toContain('NÚMERO DE CASO')
  })

  it('ningún texto que va al modelo contiene un CAS- de ejemplo para completar', () => {
    // Un placeholder tipo "CAS-..." es justamente lo que el modelo rellenó con "2024XXXXX".
    // La única mención permitida es dentro de una prohibición.
    for (const [nombre, texto] of [['KB', KB_MICELIUM], ['prompt', promptWebhook]] as const) {
      for (const m of texto.matchAll(/CAS-/g)) {
        // Ventana amplia a propósito: la prohibición puede estar unas frases antes, en el
        // mismo párrafo (el prompt cita el caso real DESPUÉS de prohibirlo).
        const contexto = texto.slice(Math.max(0, m.index - 700), m.index + 60)
        expect(contexto, `"CAS-" en ${nombre} sin una prohibición cerca`).toMatch(/NUNCA|NO dar|prohibid|PROHIBIDO/i)
      }
    }
  })
})

describe('la KB no ordena acciones que el bot no puede ejecutar', () => {
  // LA REGLA GENERAL, nacida del caso CAS-2024XXXXX (19/08/2026):
  // si un paso de la KB describe una acción que el bot no puede ejecutar, ese paso es una
  // DERIVACIÓN, no una instrucción. Auditando la KB entera con ese criterio apareció algo
  // más grande que el reclamo de Andreani: la KB nombraba CUATRO "herramientas"
  // (buscar_pedido, estado_envio, estado_envio_tn, enviar_pdf) como si el modelo pudiera
  // llamarlas. El webhook NO usa tool-calling —no hay `tools:` en la llamada a Claude— así
  // que esas funciones no existen en ningún lado.
  //
  // El mecanismo real son las ETIQUETAS de salida ([SEGUIMIENTO], [MANUAL]) que el código
  // parsea y resuelve. Un modelo al que se le dice "confirmá con buscar_pedido" y no tiene
  // buscar_pedido hace lo mismo que hizo con el N° de caso: lo simula.
  it('no nombra herramientas de tool-calling que no existen', () => {
    for (const fantasma of ['buscar_pedido', 'enviar_pdf', 'estado_envio', 'estado_envio_tn']) {
      expect(KB_MICELIUM, `La KB volvió a nombrar "${fantasma}" como herramienta: el bot no tiene tool-calling`)
        .not.toContain(fantasma)
    }
  })

  it('la verificación de compra se pide por etiqueta, que es lo que el código parsea', () => {
    expect(KB_MICELIUM).toContain('[SEGUIMIENTO]')
    expect(KB_MICELIUM).toContain('[MANUAL]')
  })

  it('no promete nombrar una sucursal concreta: no tiene el listado', () => {
    expect(KB_MICELIUM).toContain('NO tiene el listado de sucursales')
  })
})
