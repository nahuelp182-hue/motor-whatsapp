import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Este pool NO es el de lib/db.ts, a propósito. Compartir uno solo con `max: 1` haría que
// una consulta cruda y una de Prisma se esperen mutuamente, y esa es la clase de cambio que
// no se puede dar por buena sin medirla contra la base real: es el paso final del Bloque C.
// El resto de los pools (eran seis) ya se unificaron en lib/db.ts.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createClient() {
  const pool = new pg.Pool({
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT ?? 6543),
    database: 'postgres',
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD!,
    // Mismo interruptor que lib/db.ts: los dos caminos tienen que endurecerse juntos.
    ssl: { rejectUnauthorized: process.env.DB_SSL_STRICT === '1' },
    max: 1,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter, log: process.env.NODE_ENV === 'development' ? ['error'] : [] })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
