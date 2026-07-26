'use client'

import { useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { INPUT, LABEL, AYUDA, AVISO, BTN } from './ui'

// Subida de imagen / GIF / video para los widgets.
//
// EL ARCHIVO NO SE SUBE COMO VIENE. Un GIF de 50 MB en una página es la diferencia entre
// que alguien compre y que cierre la pestaña, así que el navegador lo convierte ANTES de
// subir nada:
//
//   foto (jpg/png/webp) → se achica al ancho máximo y se guarda como WebP
//   GIF                 → se convierte a video WebM, que pesa entre 10 y 20 veces menos
//                         y se reproduce igual: en bucle, sin sonido y sin controles
//   video (mp4/webm)    → pasa como está, con tope de tamaño
//
// Convertir el GIF a video es lo mismo que hacen Tiendanube y Mercado Libre, y por el mismo
// motivo: el formato GIF no comprime video, guarda una tira de imágenes enteras.

// Ancho por defecto: alcanza para una imagen a todo el ancho del texto en una pantalla
// grande sin pesar de más. Un widget puede pedir menos (`anchoMax` en su declaración de
// campo): una captura que se ve en una tarjeta de carrusel de 380 px no gana nada guardada
// a 1600, y en un carrusel de diez la diferencia pasa el mega.
const ANCHO_MAX = 1600
const CALIDAD = 0.82
const TOPE_VIDEO = 12 * 1024 * 1024

type Props = {
  valor: string
  label: string
  ayuda?: string
  /** Texto con la medida sugerida, según la proporción elegida en el widget. */
  recomendado?: string
  /** Ancho máximo en píxeles al que se achica la imagen. Sin esto, ANCHO_MAX. */
  anchoMax?: number
  onChange: (url: string) => void
}

function pesoLegible(bytes: number): string {
  if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

/** Achica manteniendo la proporción. Nunca agranda: estirar una foto chica la arruina. */
function medidas(w: number, h: number, tope: number): [number, number] {
  if (w <= tope) return [w, h]
  return [tope, Math.round((h * tope) / w)]
}

async function convertirImagen(file: File, tope: number): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const [w, h] = medidas(bitmap.width, bitmap.height, tope)
  const lienzo = document.createElement('canvas')
  lienzo.width = w
  lienzo.height = h
  lienzo.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()

  const blob = await new Promise<Blob | null>(r => lienzo.toBlob(r, 'image/webp', CALIDAD))
  if (!blob) throw new Error('No se pudo convertir la imagen.')
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' })
}

/**
 * GIF → WebM. Se decodifica cuadro por cuadro con WebCodecs y se graba el lienzo.
 * Lleva lo que dura el GIF, porque la grabación va en tiempo real.
 */
async function convertirGif(file: File, avisar: (t: string) => void, tope: number): Promise<File> {
  const Decoder = (window as unknown as { ImageDecoder?: unknown }).ImageDecoder
  if (!Decoder || typeof MediaRecorder === 'undefined') {
    throw new Error(
      'Este navegador no puede convertir GIF. Probá desde Chrome, o exportá el archivo como video MP4.',
    )
  }

  const datos = await file.arrayBuffer()
  // @ts-expect-error API del navegador todavía sin tipos en TS
  const dec = new Decoder({ data: datos, type: 'image/gif' })
  await dec.completed
  const total: number = dec.tracks.selectedTrack?.frameCount ?? 1
  if (total < 2) {
    // Un GIF de un solo cuadro es una imagen: no tiene sentido volverlo video.
    return convertirImagen(file, tope)
  }

  const primero = await dec.decode({ frameIndex: 0 })
  const [w, h] = medidas(primero.image.displayWidth, primero.image.displayHeight, tope)
  const lienzo = document.createElement('canvas')
  lienzo.width = w
  lienzo.height = h
  const ctx = lienzo.getContext('2d')!

  const stream = lienzo.captureStream()
  const tipo = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm'
  const rec = new MediaRecorder(stream, { mimeType: tipo, videoBitsPerSecond: 2_000_000 })
  const trozos: Blob[] = []
  rec.ondataavailable = e => e.data.size && trozos.push(e.data)
  rec.start()

  for (let i = 0; i < total; i++) {
    const { image } = i === 0 ? primero : await dec.decode({ frameIndex: i })
    ctx.drawImage(image, 0, 0, w, h)
    // duration viene en microsegundos; sin dato, 100 ms (lo típico de un GIF).
    const ms = image.duration ? image.duration / 1000 : 100
    image.close()
    avisar(`Convirtiendo… ${Math.round(((i + 1) / total) * 100)}%`)
    await new Promise(r => setTimeout(r, ms))
  }

  await new Promise<void>(r => {
    rec.onstop = () => r()
    rec.stop()
  })
  dec.close()

  const blob = new Blob(trozos, { type: 'video/webm' })
  return new File([blob], file.name.replace(/\.\w+$/, '') + '.webm', { type: 'video/webm' })
}

export function SubirMedia({ valor, label, ayuda, recomendado, anchoMax, onChange }: Props) {
  const tope = anchoMax && anchoMax > 0 ? anchoMax : ANCHO_MAX
  const input = useRef<HTMLInputElement>(null)
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')
  const [ahorro, setAhorro] = useState('')

  const esVideo = /\.(webm|mp4)$/i.test(valor)

  async function elegido(file: File) {
    setError('')
    setAhorro('')
    try {
      let listo: File
      if (file.type === 'image/gif') {
        setEstado('Convirtiendo el GIF a video…')
        listo = await convertirGif(file, setEstado, tope)
      } else if (file.type.startsWith('video/')) {
        if (file.size > TOPE_VIDEO) {
          throw new Error(
            `El video pesa ${pesoLegible(file.size)} y el tope son ${pesoLegible(TOPE_VIDEO)}. Recortalo o bajale la calidad antes de subirlo.`,
          )
        }
        listo = file
      } else if (file.type.startsWith('image/')) {
        setEstado('Optimizando la imagen…')
        listo = await convertirImagen(file, tope)
      } else {
        throw new Error('Formato no admitido. Serviría una imagen, un GIF o un video.')
      }

      setEstado('Subiendo…')
      const res = await upload(listo.name, listo, {
        access: 'public',
        handleUploadUrl: '/api/widgets/media',
      })

      if (listo.size < file.size) {
        setAhorro(
          `De ${pesoLegible(file.size)} a ${pesoLegible(listo.size)} — ${Math.round((1 - listo.size / file.size) * 100)}% menos.`,
        )
      }
      onChange(res.url)
      setEstado('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir el archivo.')
      setEstado('')
    }
  }

  return (
    <div>
      <label className={LABEL}>{label}</label>

      {valor ? (
        <div className="flex items-start gap-3">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[#16161f]">
            {esVideo ? (
              <video src={valor} className="h-full w-full object-cover" autoPlay loop muted playsInline />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={valor} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" className={BTN} onClick={() => input.current?.click()}>
              Cambiar
            </button>
            <button type="button" className={BTN} onClick={() => onChange('')}>
              Quitar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={`${INPUT} flex h-24 items-center justify-center border-dashed text-white/50 hover:border-white/25`}
        >
          {estado || 'Elegir imagen, GIF o video'}
        </button>
      )}

      <input
        ref={input}
        type="file"
        accept="image/*,video/mp4,video/webm"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0]
          e.target.value = '' // permite volver a elegir el mismo archivo
          if (f) void elegido(f)
        }}
      />

      {estado && valor && <p className={AYUDA}>{estado}</p>}
      {ahorro && <p className="mt-1.5 text-xs text-emerald-600">{ahorro}</p>}
      {error && <p className={`mt-1.5 ${AVISO}`}>{error}</p>}

      <p className={AYUDA}>
        {recomendado ? `Medida sugerida: ${recomendado}. ` : ''}
        Los GIF se convierten a video (pesan hasta veinte veces menos y se ven igual) y las
        fotos se achican a {tope} px y pasan a WebP. Nunca se sube el archivo original.
      </p>
      {ayuda && <p className={AYUDA}>{ayuda}</p>}
    </div>
  )
}
