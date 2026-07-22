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
  title: { default: 'Guías · Micelium', template: '%s · Micelium' },
  description:
    'Guías de cultivo de Micelium Argentina: lo esencial primero, sin relleno. Fabricamos ' +
    'incubadoras automáticas y acompañamos el cultivo.',
}

export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mic mic-fondo ${fraunces.variable} ${inter.variable}`}>
      <div className="mic-anuncio">Fabricamos los equipos. Envíos a todo el país · Garantía y soporte real.</div>

      <header className="mic-header">
        <div className="mic-header-in">
          <a href="/guia" className="mic-marca" aria-label="Micelium">
            {/* Mismo logo de la tienda, en cápsula blanca */}
            <img src="/logo-micelium.webp" alt="Micelium" />
          </a>
          <nav className="mic-nav">
            <a href="/guia">Guías</a>
            <a href="/guia/asistente">Asistente</a>
            <a href="https://infomicelium.com.ar">Tienda</a>
          </nav>
        </div>
      </header>

      <div className="mic-ancho">
        <main>{children}</main>
      </div>

      <footer className="mic-footer">
        <div className="mic-footer-in">
          <span>Micelium Argentina · Fabricamos los equipos que usás.</span>
          <span>Córdoba, Argentina</span>
        </div>
      </footer>
    </div>
  )
}
