import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'

// Subida de imágenes y videos de los widgets.
//
// El archivo va del navegador DIRECTO a Vercel Blob, no a través de esta función. Dos
// razones: una función serverless no acepta cuerpos de más de 4,5 MB (un video de 10 MB
// nunca llegaría), y hacer pasar megabytes por el servidor para reenviarlos es pagar dos
// veces el mismo tránsito. Esta ruta solo autoriza la subida y firma el token.
//
// El navegador ya entrega el archivo optimizado (ver components/widgets/SubirMedia.tsx):
// las fotos llegan como WebP redimensionado y los GIF convertidos a video. Acá se ponen los
// topes de tamaño como última línea, por si algo se saltea esa conversión.

export const runtime = 'nodejs'

// Tipos que el sitio sabe mostrar. Cualquier otra cosa se rechaza: un archivo que el
// navegador no puede pintar es un hueco en la página.
const TIPOS = [
  'image/webp',
  'image/jpeg',
  'image/png',
  'image/gif',
  'video/webm',
  'video/mp4',
]

const TOPE_BYTES = 12 * 1024 * 1024

export async function POST(req: NextRequest) {
  // El middleware ya exige sesión de dashboard para /api/widgets/media (no figura entre las
  // rutas abiertas). Esto es defensa en profundidad, no la única puerta.
  const body = (await req.json()) as HandleUploadBody

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: TIPOS,
        maximumSizeInBytes: TOPE_BYTES,
        // Sin esto, dos archivos con el mismo nombre se pisan y una imagen vieja aparece
        // de golpe en un widget que nadie tocó.
        addRandomSuffix: true,
        // Son piezas de la página: cambian poco y se piden mucho.
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      }),
      onUploadCompleted: async () => {
        // Nada que hacer: la URL se guarda en la config del widget cuando se aprieta
        // Guardar. Si nunca se guarda, queda un archivo huérfano en el store — barato y
        // preferible a borrar algo que sí se estaba usando.
      },
    })
    return NextResponse.json(json)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'no se pudo subir' },
      { status: 400 },
    )
  }
}
