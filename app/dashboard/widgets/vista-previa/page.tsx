// Página que vive dentro de un iframe en el panel. Carga el MISMO mic.js que corre en el
// sitio real, en modo vista previa, y dibuja el widget que se está editando.
//
// Se hace así a propósito: si el preview dibujara con su propio código, mostraría algo
// parecido pero no lo que la gente va a ver. Un preview que miente es peor que no tenerlo.
export const metadata = { robots: { index: false, follow: false } }

const PARRAFOS = [
  'La temperatura es lo que decide si el cultivo avanza o se detiene. No hace falta acertar a un grado exacto: hace falta no salirse del rango durante días.',
  'La segunda variable es la humedad. Cuando baja demasiado el crecimiento se frena; cuando sobra, aparece condensación y con ella los problemas.',
  'Con esas dos controladas, el resto del proceso es esperar. La mayoría de los cultivos que fallan no fallan por falta de conocimiento, sino por variaciones que nadie estaba mirando.',
  'Cada especie tiene su rango propio. Conviene elegir una sola para el primer ciclo y repetirla hasta que salga dos veces seguidas.',
  'Recién después conviene sumar variedad. Cambiar de especie antes de dominar una es la forma más rápida de no aprender de ningún resultado.',
]

export default function VistaPreviaWidget() {
  return (
    <div
      style={{
        fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Helvetica, Arial, sans-serif',
        background: '#fbfaf8',
        minHeight: '100vh',
        padding: '20px 22px 60px',
      }}
    >
      <article style={{ maxWidth: 620, margin: '0 auto' }}>
        <h1 style={{ fontSize: 25, lineHeight: 1.25, margin: '0 0 14px', color: '#2a2620' }}>
          Las dos variables que definen el resultado
        </h1>
        {PARRAFOS.map((p, i) => (
          <p key={i} style={{ fontSize: 15, lineHeight: 1.7, color: '#4e4840', margin: '0 0 16px' }}>
            {p}
          </p>
        ))}
      </article>

      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/mic.js" data-preview="1" />
    </div>
  )
}
