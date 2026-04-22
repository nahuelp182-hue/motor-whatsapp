import { NextResponse } from 'next/server'

export async function GET() {
  const url = process.env.DATABASE_URL ?? 'NO DEFINIDA'
  // Mostrar solo el host para no exponer el password
  const safe = url.replace(/:[^:@]+@/, ':***@')
  return NextResponse.json({ DATABASE_URL: safe })
}
