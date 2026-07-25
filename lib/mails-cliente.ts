// Mails al CLIENTE (no confundir con lib/notify.ts, que son alertas internas a Nahuel).
//
// Todos comparten una sola plantilla: HTML con estilos inline, porque los clientes de correo
// descartan las hojas de estilo y buena parte de lo que no sea una tabla. La paleta es la de
// marca —tierra desaturada, nada chillón— y la firma es de Mateo, como en todo el resto.
//
// Se envía por SMTP de Gmail con nodemailer, igual que las alertas internas: no depende de
// Brevo, que tiene whitelist de IP y no funciona desde Vercel (IP rotativa). El volumen de
// estos mails es bajo (uno por hito de cada cliente), muy dentro del límite de Gmail.
import nodemailer from 'nodemailer'

const GMAIL_USER = process.env.GMAIL_USER ?? 'nahuelp182@gmail.com'
const GMAIL_PASS = process.env.GMAIL_APP_PASSWORD ?? ''
const REMITENTE = process.env.MAIL_REMITENTE ?? `Micelium <${GMAIL_USER}>`

export const BASE_URL = process.env.PUBLIC_BASE_URL ?? 'https://guias.infomicelium.com.ar'
const TIENDA_URL = process.env.TIENDA_URL ?? 'https://infomicelium.com.ar'

const VERDE = '#3f4f38'
const SAGE = '#6f8a5f'
const CREMA = '#f4f2eb'
const TINTA = '#1f1c17'
const TINTA_SUAVE = '#56504a'

/** Envoltorio común: cabecera, cuerpo y firma. `cuerpo` es HTML ya armado. */
export function plantilla(titulo: string, cuerpo: string, cta?: { texto: string; url: string }): string {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:${CREMA};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREMA};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#faf9f5;border:1px solid #e2ded2;border-radius:14px;overflow:hidden;">
        <tr><td style="background:${VERDE};padding:20px 28px;">
          <span style="color:#e8ede4;font-family:Georgia,serif;font-size:18px;letter-spacing:0.02em;">Micelium&reg;</span>
        </td></tr>
        <tr><td style="padding:32px 28px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${TINTA};">
          <h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:23px;font-weight:400;line-height:1.3;color:${TINTA};">${titulo}</h1>
          ${cuerpo}
          ${
            cta
              ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 6px;"><tr><td style="background:${VERDE};border-radius:999px;">
                   <a href="${cta.url}" style="display:inline-block;padding:13px 30px;color:#ffffff;text-decoration:none;font-size:15px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">${cta.texto}</a>
                 </td></tr></table>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:0 28px 30px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;">
          <p style="margin:0;border-top:1px solid #e2ded2;padding-top:18px;font-size:14px;line-height:1.6;color:${TINTA_SUAVE};">
            Mateo<br><span style="color:${SAGE};">Equipo Micelium&reg;</span>
          </p>
          <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:#8a8179;">
            Cualquier consulta se responde por este mismo mail o por WhatsApp.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

export const p = (texto: string): string =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:${TINTA_SUAVE};">${texto}</p>`

/** Resalte dentro de un párrafo. Existe para no repetir el color a mano en cada mail. */
export const fuerte = (texto: string): string =>
  `<strong style="color:${TINTA};">${texto}</strong>`

/**
 * Bloque secundario, separado del cuerpo por una línea. Es para lo que NO es el motivo del
 * mail: se lee después del consejo y nunca antes, así el mail sigue siendo útil aunque no
 * se mire. Va apagado por defecto en todos los hitos menos donde tiene sentido.
 */
const aparte = (titulo: string, texto: string, cta: { texto: string; url: string }): string =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0 0;">
     <tr><td style="border-top:1px solid #e2ded2;padding-top:20px;">
       <div style="font-size:11px;letter-spacing:1.6px;color:${SAGE};font-weight:700;margin-bottom:8px;">TAMBI&Eacute;N DE MICELIUM</div>
       <p style="margin:0 0 10px;font-family:Georgia,serif;font-size:17px;line-height:1.35;color:${TINTA};">${titulo}</p>
       <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:${TINTA_SUAVE};">${texto}</p>
       <a href="${cta.url}" style="font-size:14px;color:${VERDE};text-decoration:underline;">${cta.texto}</a>
     </td></tr>
   </table>`

async function enviar(to: string, subject: string, html: string): Promise<boolean> {
  if (!GMAIL_PASS) {
    console.error('[mails-cliente] sin GMAIL_APP_PASSWORD: no se envía', subject)
    return false
  }
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    })
    await transporter.sendMail({ from: REMITENTE, to, subject, html })
    return true
  } catch (e) {
    console.error('[mails-cliente] falló el envío:', subject, e)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Los cuatro mails del acompañamiento. Cada uno existe porque resuelve una consulta que
// hoy llega por WhatsApp, o porque llega en el momento exacto en que el cliente duda.

/** Acceso a pedido del cliente (magic link). El único que se dispara por acción suya. */
export function mailAcceso(nombre: string, url: string): { subject: string; html: string } {
  return {
    subject: 'Tu acceso a Micelium',
    html: plantilla(
      `Hola${nombre ? ` ${nombre}` : ''}, acá está tu acceso`,
      p('Este enlace te deja adentro de tu cuenta sin que tengas que escribir ninguna contraseña.') +
        p(
          'Ahí tenés el manual completo de tu equipo, la guía de cultivo paso a paso, el estado de tu envío y un asistente que ya sabe qué compraste.',
        ) +
        p(
          '<strong style="color:' +
            TINTA +
            ';">Es de un solo uso y vence en 7 días.</strong> Al abrirlo, el navegador queda reconocido por 30 días, así que después entrás directo.',
        ),
      { texto: 'Entrar a mi cuenta', url },
    ),
  }
}

/** Se manda apenas se confirma la compra: reemplaza al PDF adjunto como puerta principal. */
export function mailBienvenida(nombre: string, url: string, soloDigital: boolean) {
  return {
    subject: soloDigital ? 'Tu material ya está disponible' : 'Tu compra está confirmada',
    html: plantilla(
      `Gracias, ${nombre}`,
      p(
        soloDigital
          ? 'Tu material ya está cargado en tu cuenta. Podés leerlo desde cualquier dispositivo y descargarlo las veces que quieras.'
          : 'Tu pedido quedó confirmado y ya estamos preparándolo. Mientras tanto, tu cuenta ya está abierta.',
      ) +
        p(
          soloDigital
            ? 'El acceso no vence: cada vez que actualicemos el material, vas a tener la versión nueva ahí mismo, sin volver a comprar nada.'
            : 'Ahí vas a encontrar el manual del equipo, la guía de cultivo completa y el seguimiento del envío en vivo. Te recomendamos leer las dos variables críticas antes de que llegue el equipo: son las que definen el resultado del primer cultivo.',
        ),
      { texto: soloDigital ? 'Ver mi material' : 'Entrar a mi cuenta', url },
    ),
  }
}

/** Día 1 desde la entrega: el momento de mayor intención de todo el ciclo. */
export function mailEntrega(nombre: string, url: string) {
  return {
    subject: 'Tu equipo llegó: por dónde empezar',
    html: plantilla(
      `${nombre}, arranquemos`,
      p('Tu equipo ya está en tu casa. Antes del primer cultivo, dos cosas que conviene tener claras:') +
        p(
          '<strong style="color:' +
            TINTA +
            ';">La sonda va siempre adherida a la base</strong>, con cinta, dentro de la bandeja. Si queda al aire, el equipo lee mal la temperatura y calienta de más. Es el error más caro y el más simple de evitar.',
        ) +
        p(
          '<strong style="color:' +
            TINTA +
            ';">La asepsia define el resultado.</strong> Todo lo que toca el cultivo va desinfectado, incluidas tus manos.',
        ) +
        p('El manual completo y el cronograma día por día están en tu cuenta.'),
      { texto: 'Ver el manual', url },
    ),
  }
}

/** Día 21: shock térmico. Llega justo cuando el cliente se pregunta si tiene que hacer algo. */
export function mailShock(nombre: string, url: string) {
  return {
    subject: 'Día 21: es el momento del shock térmico',
    html: plantilla(
      'Si tu sustrato ya está blanco, es ahora',
      p(
        `${nombre}, pasaron tres semanas desde que empezaste. Si el sustrato está completamente colonizado —blanco y compacto—, corresponde el shock térmico: el recipiente cerrado a la heladera, entre 3 y 5 °C, durante 24 horas.`,
      ) +
        p(
          'Es lo que induce la fructificación. Sin ese paso el micelio sigue creciendo, pero no forma hongos.',
        ) +
        p(
          '¿Todavía no está del todo blanco? No pasa nada: la colonización puede estirarse según la temperatura. Esperá a que termine y recién ahí hacé el shock.',
        ),
      { texto: 'Ver el paso completo', url },
    ),
  }
}

/** Día 35: cosecha. Cierra el ciclo y es el mejor momento para pedir la reseña. */
export function mailCosecha(nombre: string, url: string) {
  return {
    subject: 'Día 35: cómo y cuándo cosechar',
    html: plantilla(
      'Se cosecha cuando el velo se despega',
      p(
        `${nombre}, si todo fue en tiempo, tu cultivo está en la ventana de cosecha. El punto exacto es cuando el sombrero se abre y el velo se desprende.`,
      ) +
        p(
          'Cosechá de a una pieza, girando con suavidad desde la base. No uses cuchillo: dañás el micelio, que todavía puede darte dos oleadas más.',
        ) +
        p(
          'Después de cosechar, rehidratás el sustrato y repetís el shock térmico. El procedimiento completo está en tu cuenta.',
        ) +
        // Único lugar del ciclo donde ofrecer el siguiente equipo no interrumpe: ya cosechó,
        // o sea que el método le funcionó, y la pregunta que sigue sola es cómo hacer más.
        // En los hitos anteriores el cultivo todavía no dio resultado y sería ruido.
        aparte(
          'Cuando el cultivo ya no entra en un equipo',
          'La incubadora sostiene la temperatura adentro. Para escalar a un placard, un gabinete o una estantería entera, HALO sostiene de 25 a 35&nbsp;°C parejos en todo el mueble — y el invierno deja de definir el calendario.',
          { texto: 'Ver HALO', url: `${TIENDA_URL}/productos/halo-calentador-de-cultivos-qz5e8/` },
        ),
      { texto: 'Ver cómo seguir', url },
    ),
  }
}

export async function enviarMail(
  to: string,
  mail: { subject: string; html: string },
): Promise<boolean> {
  return enviar(to, mail.subject, mail.html)
}
