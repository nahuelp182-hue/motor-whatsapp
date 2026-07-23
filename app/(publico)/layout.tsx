import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './publico.css'

// Fraunces para títulos: serif variable con carácter, lo contrario de una tipografía de
// sistema. Inter para el cuerpo, que a tamaños chicos se lee sin ruido.
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  // metadataBase: sin esto, las URLs de og:image y los canónicos salen relativas y las tarjetas
  // al compartir se rompen. Es el dominio real de la capa pública de guías.
  metadataBase: new URL('https://guias.infomicelium.com.ar'),
  // El ® va siempre pegado al nombre: hay vendedores de insumos que usan "mycelium" y el
  // cliente confunde marca con palabra genérica. El símbolo es lo que separa una cosa de la otra.
  title: { default: 'Guías · Micelium®', template: '%s · Micelium®' },
  description:
    'Guías de cultivo de Micelium® Argentina: lo esencial primero, sin relleno. Fabricamos ' +
    'incubadoras automáticas y acompañamos el cultivo.',
  // Tarjeta al compartir. La imagen la aporta opengraph-image.tsx (marca) y cada guía define
  // la suya; acá van el tipo, el sitio y el idioma que completan la ficha.
  openGraph: {
    type: 'website',
    siteName: 'Micelium® — Guías de cultivo',
    locale: 'es_AR',
    url: '/guia',
  },
  twitter: { card: 'summary_large_image' },
}

export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mic mic-fondo ${fraunces.variable} ${inter.variable}`}>
      {/* Barra de marca: negra, el logo grande y centrado, y pegada arriba al scrollear.
          Antes el logo iba apretado dentro de una cápsula de 20 px en la fila del menú y se
          perdía. La marca es lo que estamos construyendo — tiene que estar siempre a la vista.
          El logo es negro sobre transparente: `invert` lo pasa a blanco sin necesidad de un
          segundo archivo. */}
      <div className="mic-barra-marca">
        <a href="/guia" aria-label="Micelium® — inicio">
          <img src="/logo-micelium.webp" alt="Micelium®" className="mic-barra-logo" />
        </a>
      </div>

      {/* Barra de anuncio rotativa. Los tres mensajes están en el DOM desde el servidor y
          rotan con una animación CSS pura: sin JS, sin hidratación, y los buscadores leen
          los tres. Van apilados en la misma celda de grid, así la barra toma la altura del
          más alto y no salta al cambiar. */}
      <div className="mic-anuncio">
        <span>Cada semana subimos contenido nuevo para tu cultivo</span>
        <span>Fabricación argentina · Fabricamos cada equipo Micelium®</span>
        <span>Envíos a todo el país · Garantía y soporte directo con quien lo fabricó</span>
      </div>

      <header className="mic-header">
        <div className="mic-header-in">
          <nav className="mic-nav">
            <a href="/guia">Guías</a>
            <a href="/guia/asistente">Asistente</a>
            <a href="/contacto">Contacto</a>
            <a href="https://infomicelium.com.ar">Tienda</a>
            {/* La puerta del portal tiene que estar donde ya está el cliente. Sin este link
                el área privada existía pero era invisible: nadie llega a una URL que nunca
                vio. Va último y marcado, para que no compita con el contenido público. */}
            <a href="/acceso" className="mic-nav-cuenta">
              Mi cuenta
            </a>
          </nav>
        </div>
      </header>

      <div className="mic-ancho">
        <main>{children}</main>
      </div>

      <footer className="mic-footer">
        <div className="mic-footer-in">
          <div>
            <p className="mic-footer-marca">Micelium® Argentina</p>
            <p>Fabricamos los equipos que usás. Córdoba, Argentina.</p>
            <p className="mic-footer-legal">
              Micelium® es marca registrada. No tenemos relación con vendedores de insumos que
              usan nombres parecidos.
            </p>
          </div>

          {/* Nuestros dos sitios, juntos y con la misma jerarquía: son las dos mitades de la
              misma empresa, no un item más del menú. El mismo bloque va en el pie de la tienda. */}
          <div className="mic-sitios">
            <p className="mic-sitios-tit">Nuestros sitios</p>
            <a href="https://infomicelium.com.ar" className="mic-sitio">
              <span className="mic-sitio-nombre">Tienda</span>
              <span className="mic-sitio-url">infomicelium.com.ar</span>
            </a>
            <a href="https://guias.infomicelium.com.ar" className="mic-sitio">
              <span className="mic-sitio-nombre">Guías de cultivo</span>
              <span className="mic-sitio-url">guias.infomicelium.com.ar</span>
            </a>
          </div>

          <nav className="mic-footer-links">
            <a href="/guia">Guías</a>
            <a href="/contacto">Contacto</a>
            <a href="/acceso">Mi equipo</a>
            <a href="https://infomicelium.com.ar">Tienda</a>
          </nav>

          <div className="mic-redes">
            <a
              href="https://www.instagram.com/incubadoras_micelium"
              aria-label="Instagram de Micelium"
              rel="noopener"
            >
              {/* Íconos en SVG inline: sin requests externos y nítidos en cualquier pantalla. */}
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38C1.35 2.68.93 3.35.63 4.14.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13.67.66 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.79-.3 1.46-.72 2.13-1.38.66-.67 1.08-1.34 1.38-2.13.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91-.3-.79-.72-1.46-1.38-2.13C21.32 1.35 20.65.93 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0z" />
                <path d="M12 5.84a6.16 6.16 0 100 12.32 6.16 6.16 0 000-12.32zM12 16a4 4 0 110-8 4 4 0 010 8z" />
                <circle cx="18.41" cy="5.59" r="1.44" />
              </svg>
            </a>
            <a
              href="https://www.facebook.com/239953909199103"
              aria-label="Facebook de Micelium"
              rel="noopener"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.1 24 18.1 24 12.07z" />
              </svg>
            </a>
            <a href="https://wa.me/543512145521" aria-label="WhatsApp de Micelium" rel="noopener">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.7h-.01a9.6 9.6 0 01-4.9-1.34l-.35-.21-3.64.95.97-3.55-.23-.36a9.58 9.58 0 01-1.47-5.12c0-5.3 4.32-9.6 9.63-9.6a9.56 9.56 0 016.8 2.82 9.5 9.5 0 012.82 6.79c0 5.3-4.32 9.62-9.62 9.62zM20.5 3.49A11.94 11.94 0 0012.04 0C5.45 0 .08 5.36.07 11.95c0 2.1.55 4.16 1.6 5.97L0 24l6.23-1.63a12 12 0 005.8 1.47h.01c6.59 0 11.96-5.36 11.96-11.95a11.9 11.9 0 00-3.5-8.4z" />
              </svg>
            </a>
          </div>
        </div>
      </footer>

      {/* Motor de widgets: lo que se muestra y si está prendido se maneja desde
          /dashboard/widgets, no desde acá. Este script no decide nada — pide la config y
          dibuja. Los widgets de bloque van donde haya un <div data-mic-slot="TIPO">. */}
      <script src="/mic.js" data-ctx="guias" async />
    </div>
  )
}
