// Consumo de mensajes del bot de WhatsApp — foto ANTES del cambio de tarifas del 01/10/2026.
//
// Por qué existe y por qué corre ahora: desde el 01/10/2026 Meta cobra por mensaje los
// mensajes de servicio y las plantillas de utilidad dentro de la ventana de 24 h. Lo que
// hoy es gratis pasa a costar, y el número que hace falta para presupuestarlo —cuántos
// mensajes consume una conversación y qué proporción del tráfico es inbound orgánico—
// solo se puede medir mientras siga siendo gratis. Después ya no hay línea de base.
//
// IMPORTANTE: la ventana de 72 h de los anuncios click-to-WhatsApp NO cambia; sigue
// gratis. O sea que la exposición al aumento es el tráfico ORGÁNICO, no el de campaña.
//
// Solo lee. No escribe nada.
//
//   node scripts/medir-consumo-wa.js [días]

const { Pool } = require('pg')
const fs = require('node:fs')
const path = require('node:path')

// .env.local a mano: el script corre fuera de Next, que es quien normalmente lo carga.
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  for (const linea of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = linea.match(/^([A-Z_0-9]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const DIAS = Number(process.argv[2] ?? 30)

// Conecta por DATABASE_URL, no por DB_HOST/DB_PORT. Es al revés que el runtime —y eso es
// a propósito—: los DB_* de .env.local son los del pooler de Supabase y en la copia local
// no son hostnames resolubles. DATABASE_URL es la conexión directa, la misma que usan las
// migraciones (prisma.config.ts). Este script solo lee, así que ir por la directa no tiene
// contraindicación; lo que NUNCA hay que hacer contra esta conexión es `prisma migrate dev`,
// que resetea el tracking de curiosos.
const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('Falta DATABASE_URL en .env.local')
  process.exit(1)
}
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 1 })

const fmt = (n, d = 1) => Number(n ?? 0).toFixed(d)
const linea = (t) => console.log('\n' + '='.repeat(70) + `\n  ${t}\n` + '='.repeat(70))

async function main() {
  console.log(`\nCONSUMO DEL BOT DE WHATSAPP — últimos ${DIAS} días`)
  console.log(`Foto previa al cambio de tarifas del 01/10/2026.`)

  // ── Cuánto abarca el dato ────────────────────────────────────────────────
  // Antes de dividir dos números hay que saber desde cuándo mide cada uno: el canal se
  // movió a su propia columna el 01/08 y el bot de WhatsApp arrancó el 11/07. Un promedio
  // que cruce esas fechas mezcla períodos que no son comparables.
  const cobertura = await pool.query(`
    SELECT min(ts)::date AS desde, max(ts)::date AS hasta, count(*) AS filas
      FROM ig_diag WHERE canal = 'wa' AND ts > now() - ($1 || ' days')::interval`, [String(DIAS)])
  const c = cobertura.rows[0]
  console.log(`Datos de canal='wa': ${c.desde} → ${c.hasta} (${c.filas} eventos)`)
  if (Number(c.filas) === 0) {
    console.log('\n⚠️  Sin eventos con canal=\'wa\'. Antes del 01/08/2026 el canal se marcaba')
    console.log('   adentro del JSON de detalle. Ampliá los días o revisá ig_diag a mano.')
    return
  }

  // ── 1. Mensajes por conversación ─────────────────────────────────────────
  // Una "conversación" = mensajes de un mismo número separados por menos de 24 h, que es
  // la ventana que Meta factura. Se cuentan los mensajes SALIENTES ('pensado'), que son
  // los que se cobran: los entrantes del cliente nunca se cobran.
  linea('1. MENSAJES SALIENTES POR CONVERSACIÓN (lo que se va a cobrar)')
  const conv = await pool.query(`
    WITH eventos AS (
      SELECT sender, ts,
             CASE WHEN ts - lag(ts) OVER (PARTITION BY sender ORDER BY ts) > interval '24 hours'
                       OR lag(ts) OVER (PARTITION BY sender ORDER BY ts) IS NULL
                  THEN 1 ELSE 0 END AS nueva
        FROM ig_diag
       WHERE canal = 'wa' AND kind = 'pensado' AND ts > now() - ($1 || ' days')::interval
    ), numeradas AS (
      SELECT sender, sum(nueva) OVER (PARTITION BY sender ORDER BY ts) AS conv_id
        FROM eventos
    ), porconv AS (
      SELECT sender, conv_id, count(*) AS mensajes FROM numeradas GROUP BY sender, conv_id
    )
    SELECT count(*) AS conversaciones, sum(mensajes) AS mensajes,
           avg(mensajes) AS promedio,
           percentile_cont(0.5) WITHIN GROUP (ORDER BY mensajes) AS mediana,
           percentile_cont(0.9) WITHIN GROUP (ORDER BY mensajes) AS p90,
           max(mensajes) AS maximo
      FROM porconv`, [String(DIAS)])
  const k = conv.rows[0]
  console.log(`  Conversaciones:        ${k.conversaciones}`)
  console.log(`  Mensajes salientes:    ${k.mensajes}`)
  console.log(`  Promedio por charla:   ${fmt(k.promedio)}`)
  console.log(`  Mediana:               ${fmt(k.mediana)}`)
  console.log(`  Percentil 90:          ${fmt(k.p90)}`)
  console.log(`  Máximo:                ${k.maximo}`)

  // ── 2. Origen del tráfico ────────────────────────────────────────────────
  // La pregunta que decide el presupuesto: cuánto del tráfico entra por un anuncio (que
  // sigue gratis 72 h) y cuánto por su cuenta (que pasa a cobrarse).
  linea('2. ORIGEN — qué parte queda expuesta al cambio de tarifas')
  const origen = await pool.query(`
    WITH primeros AS (
      SELECT DISTINCT ON (sender) sender, ts
        FROM ig_diag
       WHERE canal = 'wa' AND kind = 'recibido' AND ts > now() - ($1 || ' days')::interval
       ORDER BY sender, ts
    )
    SELECT
      count(*) AS numeros,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ig_diag d WHERE d.sender = p.sender AND d.kind = 'ctwa_origen'
           AND d.ts BETWEEN p.ts - interval '1 hour' AND p.ts + interval '1 hour'
      )) AS desde_ads
      FROM primeros p`, [String(DIAS)])
  const o = origen.rows[0]
  const organicos = Number(o.numeros) - Number(o.desde_ads)
  console.log(`  Números que escribieron:  ${o.numeros}`)
  console.log(`  Venían de un anuncio:     ${o.desde_ads}   → ventana de 72 h, SIGUE GRATIS`)
  console.log(`  Orgánicos:                ${organicos}   → 🔴 PASA A COBRARSE el 01/10`)
  if (Number(o.desde_ads) === 0) {
    console.log(`\n  ℹ️  Cero desde ads es lo esperado: 'ctwa_origen' se empezó a registrar el`)
    console.log(`     01/08/2026 y todavía no hay campaña click-to-WhatsApp corriendo.`)
    console.log(`     Hoy el 100% del tráfico es del lado que se encarece.`)
  }

  // ── 3. Volumen diario ────────────────────────────────────────────────────
  linea('3. MENSAJES SALIENTES POR DÍA')
  const dia = await pool.query(`
    SELECT ts::date AS dia, count(*) AS n
      FROM ig_diag
     WHERE canal = 'wa' AND kind = 'pensado' AND ts > now() - ($1 || ' days')::interval
     GROUP BY 1 ORDER BY 1 DESC LIMIT 14`, [String(DIAS)])
  for (const r of dia.rows) console.log(`  ${r.dia.toISOString().slice(0, 10)}  ${String(r.n).padStart(4)}`)
  const totalMsg = Number(k.mensajes ?? 0)
  const porDia = totalMsg / DIAS
  console.log(`\n  Promedio: ${fmt(porDia)} mensajes salientes/día`)

  // ── 4. Costo de IA (esto YA se paga) ─────────────────────────────────────
  linea('4. COSTO DE IA — lo que ya pagás hoy')
  const ia = await pool.query(`
    SELECT channel, count(*) AS llamadas, sum(cost_usd) AS usd,
           sum(input_tokens) AS inp, sum(output_tokens) AS outp
      FROM claude_usage
     WHERE ts > now() - ($1 || ' days')::interval
     GROUP BY channel ORDER BY 3 DESC NULLS LAST`, [String(DIAS)])
  let usdTotal = 0
  for (const r of ia.rows) {
    usdTotal += Number(r.usd ?? 0)
    console.log(`  ${String(r.channel).padEnd(12)} ${String(r.llamadas).padStart(5)} llamadas  USD ${fmt(r.usd, 2).padStart(8)}  (in ${r.inp} / out ${r.outp})`)
  }
  console.log(`  ${'TOTAL'.padEnd(12)} ${' '.repeat(5)}           USD ${fmt(usdTotal, 2).padStart(8)}  → USD ${fmt(usdTotal / DIAS * 30, 2)}/mes`)

  // ── 5. Qué significa ─────────────────────────────────────────────────────
  linea('5. LECTURA')
  console.log(`  Costo de IA hoy:              USD ${fmt(usdTotal / DIAS * 30, 2)}/mes`)
  console.log(`  Mensajes salientes/mes:       ${fmt(porDia * 30, 0)}`)
  console.log(`  De esos, expuestos al cambio: ~${fmt(organicos / Math.max(Number(o.numeros), 1) * 100, 0)}% (los orgánicos)`)
  console.log(`\n  ⚠️  Meta todavía NO publicó las tarifas del 01/10 — se comprometió a`)
  console.log(`     hacerlo antes del 01/09/2026. Con el volumen de arriba, cuando salga el`)
  console.log(`     número la cuenta es una multiplicación.`)
  console.log(`\n  Volver a correr este script el 01/09 con las tarifas ya publicadas.`)
}

main()
  .catch((e) => { console.error('\n❌', e.message); process.exitCode = 1 })
  .finally(() => pool.end())
