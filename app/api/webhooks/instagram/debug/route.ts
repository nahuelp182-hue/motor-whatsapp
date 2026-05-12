import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Almacena el último payload recibido en memoria (se resetea con cada deploy)
let lastPayload: unknown = null
let lastReceived: string | null = null

export async function GET() {
  return NextResponse.json({
    lastReceived,
    lastPayload,
    env: {
      IG_ID: process.env.IG_ACCOUNT_ID ?? 'NO CARGADO',
      FB_PAGE_TOKEN: process.env.FB_PAGE_TOKEN ? 'OK (cargado)' : 'NO CARGADO',
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'OK (cargado)' : 'NO CARGADO',
      INSTAGRAM_VERIFY_TOKEN: process.env.INSTAGRAM_VERIFY_TOKEN ?? 'NO CARGADO',
    }
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  lastPayload = body
  lastReceived = new Date().toISOString()
  return NextResponse.json({ ok: true })
}
