import { ImageResponse } from 'next/og'

/**
 * Tarjeta al compartir (Open Graph / Twitter). Una sola implementación para la portada y para
 * cada guía: cambian el eyebrow y el título, el resto es la misma placa de marca. Es lo que se
 * ve cuando alguien pega el link en WhatsApp, Instagram o Facebook — antes salía sin imagen.
 *
 * Colores calcados de la capa pública (publico.css): verde casi negro de fondo, sage para la
 * volanta, crema para el texto. Sin fuentes externas: la default de `next/og` alcanza para una
 * placa, y evita cargar un .ttf en cada render.
 */
export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

export function ogImagen({ eyebrow, titulo }: { eyebrow: string; titulo: string }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background:
            'radial-gradient(1000px 500px at 78% -12%, #17251c, #101a14 60%)',
          color: '#f4f2eb',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Aro tenue, el mismo ornamento del hero de las páginas */}
        <div
          style={{
            position: 'absolute',
            top: -140,
            right: -160,
            width: 520,
            height: 520,
            borderRadius: '50%',
            border: '1px solid rgba(111, 138, 95, 0.28)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 44, height: 1, background: '#6f8a5f', display: 'flex' }} />
          <span
            style={{
              fontSize: 24,
              letterSpacing: 6,
              textTransform: 'uppercase',
              color: '#8fa87e',
            }}
          >
            {eyebrow}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <span style={{ fontSize: 68, lineHeight: 1.08, color: '#faf9f5', maxWidth: 920 }}>
            {titulo}
          </span>
          <div style={{ width: 96, height: 4, background: '#487132', display: 'flex' }} />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            color: '#9db097',
            fontSize: 26,
          }}
        >
          <span style={{ color: '#f4f2eb', fontSize: 30 }}>Micelium®</span>
          <span>guias.infomicelium.com.ar</span>
        </div>
      </div>
    ),
    OG_SIZE,
  )
}
