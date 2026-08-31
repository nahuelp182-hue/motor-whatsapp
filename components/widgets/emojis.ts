// Catálogo amplio para el buscador de emoji del panel (CampoEditor.tsx). Los 18 "de marca"
// (lib/widgets/tipos.ts EMOJIS) siguen siendo el atajo de siempre, sueltos arriba del
// selector; esto es lo que aparece detrás de "Más emojis…" para el resto de los casos —
// no todo Unicode (unos cuantos miles de símbolos que nadie va a usar en un widget de
// e-commerce), sino un recorte curado con lo que realmente puede hacer falta: reacciones,
// objetos, comida, clima, banderas de uso común, etc. Cada entrada lleva palabras clave en
// español para que buscar "camión" encuentre 🚚 sin saber que se llama "delivery truck".

export type EmojiEntry = { char: string; kw: string }

export const CATALOGO_EMOJIS: EmojiEntry[] = [
  // Caras y reacciones
  { char: '😀', kw: 'sonrisa feliz cara' },
  { char: '😃', kw: 'sonrisa feliz cara contento' },
  { char: '😄', kw: 'sonrisa feliz cara risa' },
  { char: '😁', kw: 'sonrisa dientes feliz' },
  { char: '😊', kw: 'sonrisa timido feliz' },
  { char: '🙂', kw: 'sonrisa leve cara' },
  { char: '😉', kw: 'guino cara' },
  { char: '😍', kw: 'enamorado corazones ojos' },
  { char: '🥰', kw: 'enamorado corazones cariño' },
  { char: '😘', kw: 'beso cara' },
  { char: '😎', kw: 'lentes sol cool' },
  { char: '🤩', kw: 'estrellas asombro fan' },
  { char: '🥳', kw: 'fiesta celebracion' },
  { char: '😅', kw: 'risa nervioso alivio' },
  { char: '😂', kw: 'risa llanto gracioso' },
  { char: '🤔', kw: 'pensando duda' },
  { char: '😮', kw: 'sorpresa cara' },
  { char: '😲', kw: 'asombro sorpresa' },
  { char: '🙄', kw: 'ojos en blanco' },
  { char: '😴', kw: 'dormido sueño' },
  { char: '🤗', kw: 'abrazo cariño' },
  { char: '🙌', kw: 'manos arriba celebracion' },
  { char: '👏', kw: 'aplauso felicitacion' },
  { char: '🙏', kw: 'gracias por favor rezo manos' },
  { char: '👍', kw: 'like bien pulgar aprobado' },
  { char: '👎', kw: 'mal pulgar no' },
  { char: '👋', kw: 'saludo hola chau mano' },
  { char: '✋', kw: 'mano alto stop pare' },
  { char: '👌', kw: 'perfecto ok mano' },
  { char: '✌️', kw: 'paz victoria mano' },
  { char: '💪', kw: 'fuerza brazo musculo' },
  { char: '🤝', kw: 'apreton manos acuerdo confianza trato' },
  { char: '👀', kw: 'ojos mirando viendo' },
  { char: '🧠', kw: 'cerebro mente inteligencia' },
  { char: '❤️', kw: 'corazon amor rojo' },
  { char: '🧡', kw: 'corazon naranja' },
  { char: '💛', kw: 'corazon amarillo' },
  { char: '💚', kw: 'corazon verde' },
  { char: '💙', kw: 'corazon azul' },
  { char: '💜', kw: 'corazon violeta' },
  { char: '🖤', kw: 'corazon negro' },
  { char: '🤍', kw: 'corazon blanco' },
  { char: '💯', kw: 'cien perfecto puntaje' },
  { char: '🔥', kw: 'fuego tendencia caliente' },
  { char: '✨', kw: 'brillo destello magia' },
  { char: '⭐', kw: 'estrella calificacion reseña' },
  { char: '🌟', kw: 'estrella brillante destacado' },
  { char: '💫', kw: 'estrella mareo brillo' },
  { char: '⚡', kw: 'rayo rapido energia' },
  { char: '💥', kw: 'explosion impacto' },

  // Confianza, garantía, seguridad
  { char: '✅', kw: 'check listo confirmado si aprobado' },
  { char: '☑️', kw: 'check casilla confirmado' },
  { char: '✔️', kw: 'check listo confirmado' },
  { char: '❌', kw: 'equis no cancelar rechazado' },
  { char: '🛡️', kw: 'escudo garantia proteccion seguridad' },
  { char: '🔒', kw: 'candado seguro privado' },
  { char: '🔐', kw: 'candado llave seguro' },
  { char: '🔑', kw: 'llave acceso clave' },
  { char: '🏆', kw: 'trofeo premio ganador calidad' },
  { char: '🥇', kw: 'medalla oro primero' },
  { char: '🎖️', kw: 'medalla honor certificado' },
  { char: '📜', kw: 'certificado diploma pergamino' },
  { char: '🧾', kw: 'factura recibo comprobante' },
  { char: '💳', kw: 'tarjeta pago cuotas credito' },
  { char: '💰', kw: 'dinero plata bolsa' },
  { char: '💵', kw: 'dinero billete efectivo' },
  { char: '🏦', kw: 'banco financiero' },

  // Envío, tiempo, logística
  { char: '📦', kw: 'paquete envio caja pedido' },
  { char: '🚚', kw: 'camion envio delivery transporte' },
  { char: '🚛', kw: 'camion transporte carga' },
  { char: '✈️', kw: 'avion envio internacional' },
  { char: '🚀', kw: 'cohete rapido lanzamiento upgrade' },
  { char: '⏱️', kw: 'cronometro tiempo demora' },
  { char: '⏳', kw: 'reloj arena espera cuenta regresiva' },
  { char: '⌛', kw: 'reloj arena tiempo agotado' },
  { char: '🕒', kw: 'reloj hora horario corte' },
  { char: '📅', kw: 'calendario fecha agenda' },
  { char: '🗓️', kw: 'calendario fecha' },
  { char: '📍', kw: 'ubicacion pin lugar direccion' },
  { char: '🗺️', kw: 'mapa ubicacion' },

  // Comunicación
  { char: '💬', kw: 'chat mensaje burbuja hablar' },
  { char: '💭', kw: 'pensamiento globo idea' },
  { char: '📱', kw: 'celular telefono movil whatsapp' },
  { char: '☎️', kw: 'telefono llamada' },
  { char: '📞', kw: 'telefono llamada' },
  { char: '✉️', kw: 'sobre email correo mensaje' },
  { char: '📧', kw: 'email correo' },
  { char: '📨', kw: 'email mensaje recibido' },
  { char: '📢', kw: 'megafono anuncio aviso' },
  { char: '📣', kw: 'megafono anuncio promocion' },
  { char: '🔔', kw: 'campana notificacion aviso' },
  { char: '🔕', kw: 'campana silenciada sin notificacion' },

  // Documentos, ayuda, info
  { char: '📋', kw: 'portapapeles lista especificaciones' },
  { char: '📝', kw: 'nota escribir formulario' },
  { char: '📄', kw: 'documento pagina hoja' },
  { char: '📖', kw: 'libro guia lectura' },
  { char: '📚', kw: 'libros guias biblioteca' },
  { char: '❓', kw: 'pregunta duda faq' },
  { char: '❔', kw: 'pregunta duda' },
  { char: '❗', kw: 'exclamacion importante alerta' },
  { char: '⚠️', kw: 'advertencia alerta cuidado' },
  { char: 'ℹ️', kw: 'informacion info' },
  { char: '💡', kw: 'idea foco tip consejo' },
  { char: '🔍', kw: 'lupa buscar' },
  { char: '🔎', kw: 'lupa buscar' },
  { char: '🔢', kw: 'numeros pasos orden' },

  // Casa y producto
  { char: '🏠', kw: 'casa hogar' },
  { char: '🏡', kw: 'casa hogar jardin' },
  { char: '🔧', kw: 'llave herramienta mantenimiento' },
  { char: '🔨', kw: 'martillo herramienta' },
  { char: '⚙️', kw: 'engranaje configuracion ajuste' },
  { char: '🛠️', kw: 'herramientas mantenimiento' },
  { char: '🔬', kw: 'microscopio laboratorio ciencia' },
  { char: '🧪', kw: 'tubo ensayo experimento ciencia' },
  { char: '🌡️', kw: 'termometro temperatura clima' },
  { char: '💧', kw: 'gota agua humedad' },
  { char: '🌱', kw: 'brote planta cultivo natural' },
  { char: '🍃', kw: 'hojas natural viento eco' },
  { char: '🌿', kw: 'planta hierba natural' },
  { char: '🌳', kw: 'arbol natural' },
  { char: '☀️', kw: 'sol clima dia' },
  { char: '🌤️', kw: 'sol nube clima' },
  { char: '🌧️', kw: 'lluvia clima' },

  // Compras y comercio
  { char: '🛒', kw: 'carrito compra' },
  { char: '🛍️', kw: 'bolsas compra shopping' },
  { char: '🏷️', kw: 'etiqueta precio oferta' },
  { char: '💲', kw: 'signo pesos precio dinero' },
  { char: '🎁', kw: 'regalo caja sorpresa' },
  { char: '🎉', kw: 'confeti celebracion fiesta' },
  { char: '🎊', kw: 'confeti fiesta celebracion' },
  { char: '🧩', kw: 'rompecabezas pieza complemento' },

  // Gráficos y progreso
  { char: '📈', kw: 'grafico creciente ventas resultado' },
  { char: '📉', kw: 'grafico decreciente baja' },
  { char: '📊', kw: 'grafico barras estadistica' },
  { char: '🎯', kw: 'objetivo meta blanco foco' },
]

/** Filtra el catálogo por texto libre: matchea contra el emoji mismo o sus palabras clave. */
export function buscarEmojis(q: string): EmojiEntry[] {
  const t = q.trim().toLowerCase()
  if (!t) return CATALOGO_EMOJIS
  return CATALOGO_EMOJIS.filter(e => e.kw.includes(t) || e.char === q)
}
