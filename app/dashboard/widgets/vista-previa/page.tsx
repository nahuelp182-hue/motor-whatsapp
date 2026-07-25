import { productosTN } from '@/lib/widgets/productos'

// Página que vive dentro de un iframe en el panel. Carga el MISMO mic.js que corre en el
// sitio real, en modo vista previa, y dibuja el widget que se está editando.
//
// Se hace así a propósito: si el preview dibujara con su propio código, mostraría algo
// parecido pero no lo que la gente va a ver. Un preview que miente es peor que no tenerlo.
//
// Hay DOS escenarios porque hay dos páginas distintas, y media docena de widgets solo
// funcionan en una de ellas: los de precio leen el precio de la página, la barra de compra
// se engancha al botón real de Tiendanube, el progreso de envío mira el carrito. Sobre un
// texto de blog todos esos se plantan y el recuadro queda en blanco — que es lo que hacía
// dudar de la vista previa. El escenario "ficha" reproduce la columna de compra de
// Tiendanube con sus clases reales (js-price-display, js-addtocart, js-product-form…) y con
// el precio REAL del producto elegido, traído del catálogo.
export const metadata = { robots: { index: false, follow: false } }

const PARRAFOS = [
  'La temperatura es lo que decide si el cultivo avanza o se detiene. No hace falta acertar a un grado exacto: hace falta no salirse del rango durante días.',
  'La segunda variable es la humedad. Cuando baja demasiado el crecimiento se frena; cuando sobra, aparece condensación y con ella los problemas.',
  'Con esas dos controladas, el resto del proceso es esperar. La mayoría de los cultivos que fallan no fallan por falta de conocimiento, sino por variaciones que nadie estaba mirando.',
  'Cada especie tiene su rango propio. Conviene elegir una sola para el primer ciclo y repetirla hasta que salga dos veces seguidas.',
  'Recién después conviene sumar variedad. Cambiar de especie antes de dominar una es la forma más rápida de no aprender de ningún resultado.',
]

const pesos = (n: number) =>
  '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n)

type Props = { searchParams: Promise<{ e?: string; p?: string }> }

export default async function VistaPreviaWidget({ searchParams }: Props) {
  const sp = await searchParams
  const ficha = sp.e === 'producto'

  // El producto simulado sale del catálogo real: nombre, precio, precio tachado e imagen son
  // los que están publicados ahora en Tiendanube. Con un precio inventado, el widget de
  // cuotas mostraría una cuota que no existe.
  const catalogo = ficha ? await productosTN() : []
  const elegido = catalogo.find(p => p.id === String(sp.p ?? '')) ?? catalogo[0] ?? null
  const precio = elegido?.precio ?? 0
  const lista = elegido?.precioLista ?? 0

  return (
    <div
      style={{
        fontFamily: 'ui-sans-serif, system-ui, "Segoe UI", Helvetica, Arial, sans-serif',
        background: '#fbfaf8',
        minHeight: '100vh',
        padding: '20px 22px 60px',
      }}
    >
      {ficha ? (
        <FichaProducto
          nombre={elegido?.nombre ?? 'Producto'}
          imagen={elegido?.imagen ?? null}
          precio={precio}
          lista={lista}
        />
      ) : (
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
      )}

      {/* `LS` es el objeto que Tiendanube expone en su storefront: mic.js lo consulta para
          saber en qué plantilla está, qué producto se ve y qué hay en el carrito. Acá se
          reproduce con los datos del producto simulado —un carrito con esa unidad adentro—
          para que los widgets que dependen del carrito dibujen en vez de plantarse. Va antes
          de mic.js porque el script lo lee al arrancar. */}
      {ficha && (
        <script
          dangerouslySetInnerHTML={{
            __html:
              `window.LS={template:'product',product:{id:${JSON.stringify(elegido?.id ?? '')}},` +
              `cart:{subtotal:${Math.round(precio * 100)},items:[{product_id:${JSON.stringify(elegido?.id ?? '')},quantity:1}]},` +
              `on:function(){},events:{}};`,
          }}
        />
      )}

      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/mic.js" data-preview="1" data-ctx={ficha ? 'producto' : 'guias'} />
    </div>
  )
}

/* Réplica de la ficha de producto de Tiendanube: los mismos bloques, en el mismo orden y con
   las MISMAS clases que usa el tema. De ahí salen las anclas de ubicación ("debajo del
   precio", "debajo del botón") y los precios que leen los widgets. Si el tema cambiara una
   clase, este archivo y el mapa ANCLAS de mic.js se corrigen juntos. */
function FichaProducto({
  nombre,
  imagen,
  precio,
  lista,
}: {
  nombre: string
  imagen: string | null
  precio: number
  lista: number
}) {
  const caja = { border: '1px solid #eae5dc', borderRadius: 10, background: '#fff' }
  return (
    <div
      className="js-product-detail"
      style={{
        maxWidth: 900,
        margin: '0 auto',
        display: 'grid',
        gap: 24,
        gridTemplateColumns: 'minmax(0,0.8fr) minmax(0,1fr)',
      }}
    >
      <div style={{ ...caja, aspectRatio: '1/1', overflow: 'hidden' }}>
        {imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagen}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : null}
      </div>

      <div className="product-detail-container">
        <div className="page-header">
          <h1
            className="js-product-name"
            style={{ fontSize: 22, lineHeight: 1.25, margin: '0 0 12px', color: '#2a2620' }}
          >
            {nombre}
          </h1>
        </div>

        <div className="js-price-container" style={{ marginBottom: 12 }}>
          {lista > precio && (
            <span
              id="compare_price_display"
              style={{ marginRight: 8, fontSize: 15, color: '#8c8c82', textDecoration: 'line-through' }}
            >
              {pesos(lista)}
            </span>
          )}
          <span className="js-price-display" style={{ fontSize: 26, fontWeight: 700, color: '#2a2620' }}>
            {pesos(precio)}
          </span>
        </div>

        <div
          className="js-product-payments-container"
          style={{ marginBottom: 12, fontSize: 13.5, color: '#6a6157' }}
        >
          Hasta 6 cuotas sin interés · Ver medios de pago
        </div>

        <div
          className="js-free-shipping-minimum-message"
          style={{ marginBottom: 14, fontSize: 13.5, color: '#6f8a5f' }}
        >
          Envío gratis a todo el país
        </div>

        <form className="js-product-form" style={{ ...caja, padding: 14, marginBottom: 16 }}>
          <div style={{ marginBottom: 10, fontSize: 13, color: '#6a6157' }}>Cantidad: 1</div>
          <button
            type="button"
            className="js-addtocart"
            style={{
              width: '100%',
              padding: 13,
              border: 0,
              borderRadius: 8,
              background: '#2a2620',
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Agregar al carrito
          </button>
        </form>

        <div
          className="js-product-description"
          style={{ fontSize: 14.5, lineHeight: 1.65, color: '#4e4840' }}
        >
          <p style={{ margin: '0 0 12px' }}>{PARRAFOS[0]}</p>
          <p style={{ margin: 0 }}>{PARRAFOS[1]}</p>
        </div>
      </div>
    </div>
  )
}
