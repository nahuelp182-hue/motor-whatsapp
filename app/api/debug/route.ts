import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    DB_HOST: process.env.DB_HOST ?? 'UNDEFINED',
    DB_PORT: process.env.DB_PORT ?? 'UNDEFINED',
    DB_USER: process.env.DB_USER ?? 'UNDEFINED',
    DB_PASSWORD_SET: process.env.DB_PASSWORD ? 'YES' : 'NO',
    DATABASE_URL: (process.env.DATABASE_URL ?? 'UNDEFINED').replace(/:[^:@]+@/, ':***@'),
  })
}
