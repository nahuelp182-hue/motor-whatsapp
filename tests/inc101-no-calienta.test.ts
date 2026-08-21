import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { KB_MICELIUM } from '@/lib/kb-micelium'

// EL CASO QUE ESTO PREVIENE (21/08/2026, conversación en vivo)
//
// Un cliente escribió "No levanta temperatura / la seteo en 28 y sigue a temperatura
// ambiente hace un par de días". El bot diagnosticó bien —preguntó por la sonda, el
// micropore y el clic del calentador— pero al no escuchar el clic concluyó "puede ser un
// problema eléctrico o del controlador" y lo mandó al servicio técnico pidiéndole el
// número de pedido.
//
// La causa real, según Nahuel, es otra: en la INC101 lo más frecuente es el controlador mal
// configurado (F1/F2/F4). Se resuelve en 30 segundos por WhatsApp. Derivarlo a técnico
// convierte una consulta de configuración en un caso de garantía.
//
// La KB no tenía F1/F2/F4 en ninguna parte, así que el bot NO PODÍA resolverlo: no era que
// se olvidara, es que el dato no existía. Mismo patrón que el CAS-2024XXXXX pero al revés:
// allá se le pedía algo que no podía hacer; acá le faltaba lo que sí podía.
const promptWebhook = fs.readFileSync('app/api/webhooks/whatsapp/route.ts', 'utf8')

describe('INC101 que no calienta: configuración antes que garantía', () => {
  it('la KB trae los tres valores del controlador', () => {
    expect(KB_MICELIUM).toMatch(/\*\*F1\*\*/)
    expect(KB_MICELIUM).toMatch(/\*\*F2\*\*/)
    expect(KB_MICELIUM).toMatch(/\*\*F4\*\*/)
    // F4 en cero es el error más común: si se pierde este dato, se pierde el diagnóstico.
    expect(KB_MICELIUM).toMatch(/F4 distinto de cero es el error más común/)
  })

  it('el prompt le dice al bot que NO derive de entrada', () => {
    expect(promptWebhook).toContain('INC101 QUE NO CALIENTA')
    expect(promptWebhook).toMatch(/NO lo trates como falla del equipo ni lo derives de entrada/)
  })

  it('deja la puerta abierta a derivar si la configuración ya estaba bien', () => {
    // No se trata de no derivar nunca: se trata de no derivar ANTES de revisar lo simple.
    expect(KB_MICELIUM).toContain('sigue sin calentar ni hacer clic')
    expect(KB_MICELIUM).toContain('[FEEDBACK] y derivar')
    expect(promptWebhook).toMatch(/Solo si con F1\/F2\/F4 bien configurados sigue sin calentar/)
  })

  it('acota los valores a la INC101 y NO a la PC400 ni al HALO', () => {
    // La PC400 y el HALO tienen otro controlador: ofrecerles F1/F2/F4 sería inventar.
    expect(KB_MICELIUM).toContain('SOLO para la Incubadora INC101')
    expect(KB_MICELIUM).toMatch(/PC400 y el HALO tienen otro controlador/)
    expect(promptWebhook).toMatch(/esto es SOLO de la INC101/)
  })

  it('manda al video del manual, que es donde está el paso a paso', () => {
    expect(KB_MICELIUM).toMatch(/video que viene con el manual/)
  })
})
