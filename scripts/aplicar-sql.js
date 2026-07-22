// Aplica un .sql contra DATABASE_URL. Los scripts de prisma/sql/ son aditivos
// (IF NOT EXISTS), así que correrlo dos veces no rompe nada.
//   node scripts/aplicar-sql.js prisma/sql/widgets_tables.sql
const fs = require('fs')
const pg = require('pg')

const archivo = process.argv[2]
if (!archivo) {
  console.error('Uso: node scripts/aplicar-sql.js <archivo.sql>')
  process.exit(1)
}

for (const linea of fs.readFileSync('.env.local', 'utf8').split('\n')) {
  const m = linea.match(/^([A-Z_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

;(async () => {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  await client.query(fs.readFileSync(archivo, 'utf8'))
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE 'Widget%' ORDER BY table_name`,
  )
  console.log('Tablas presentes:', rows.map(r => r.table_name).join(', ') || '(ninguna)')
  await client.end()
})().catch(e => {
  console.error('Falló:', e.message)
  process.exit(1)
})
