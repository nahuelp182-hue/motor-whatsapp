/**
 * Importa todos los pedidos pagos desde el 1° de abril 2026
 * Ejecutar: node scripts/import-abril.js
 */

const https = require('https');
const fs = require('fs');
const { Client } = require('pg');

// ── Config ────────────────────────────────────────────────────────────────────
const TN_STORE_ID = '1957278';
const TN_TOKEN = JSON.parse(fs.readFileSync('C:/Users/Usuario/.claude/tiendanube-config.json', 'utf8')).access_token;

const DB = {
  host: 'db.inrzkvmtwwufavahccks.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '##1990Nahuel0991',
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function tnGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.tiendanube.com',
      path: `/v1/${TN_STORE_ID}${path}`,
      headers: {
        'Authentication': 'bearer ' + TN_TOKEN,
        'User-Agent': 'Micelium/1.0 (nahuelp182@gmail.com)'
      }
    };
    https.get(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
}

function normalizePhone(raw) {
  if (!raw) return null;
  const d = raw.replace(/\D/g, '');
  const local = d.startsWith('0') ? d.slice(1) : d;
  if (local.startsWith('549')) return local;
  if (local.startsWith('54')) return '549' + local.slice(2);
  return '549' + local;
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const db = new Client(DB);
  await db.connect();
  console.log('DB conectada\n');

  // Buscar el store_id en la DB
  const storeRes = await db.query(`SELECT id, nombre FROM "Store" LIMIT 1`);
  if (!storeRes.rows.length) {
    console.error('No hay ninguna Store en la DB. Registrá la tienda primero desde el OAuth.');
    process.exit(1);
  }
  const store = storeRes.rows[0];
  console.log(`Store: ${store.nombre} (${store.id})\n`);

  // Traer todos los pedidos pagos desde 2021
  let page = 1;
  let allOrders = [];
  while (true) {
    const orders = await tnGet(`/orders?payment_status=paid&created_at_min=2021-01-01T00:00:00-03:00&per_page=50&page=${page}`);
    if (!orders.length) break;
    allOrders = allOrders.concat(orders);
    console.log(`Página ${page}: ${orders.length} pedidos (acumulado: ${allOrders.length})`);
    if (orders.length < 50) break;
    page++;
    await new Promise(r => setTimeout(r, 300)); // evitar rate limit
  }

  // Filtrar solo pedidos con envío físico (excluir ebooks/digitales sin teléfono)
  const physical = allOrders.filter(o => o.contact_phone && parseFloat(o.total) > 0);
  console.log(`\nTotal pedidos a importar: ${physical.length}\n`);

  let inserted = 0, updated = 0, skipped = 0;

  for (const order of physical) {
    const telefono = normalizePhone(order.contact_phone);
    if (!telefono) { skipped++; continue; }

    const total = parseFloat(order.total) || 0;
    const nombre = order.contact_name || 'Sin nombre';
    const orderDate = order.created_at || new Date().toISOString();

    // Upsert customer por teléfono (clave única real)
    const res = await db.query(`
      INSERT INTO "Customer" (
        id, store_id, tiendanube_customer_id, nombre, telefono, total_spent, "createdAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6
      )
      ON CONFLICT (store_id, tiendanube_customer_id)
      DO UPDATE SET
        total_spent = "Customer".total_spent + EXCLUDED.total_spent
      RETURNING (xmax = 0) AS is_insert
    `, [store.id, telefono, nombre, telefono, total, orderDate]);

    if (res.rows[0]?.is_insert) inserted++;
    else updated++;

    const status = res.rows[0]?.is_insert ? 'NUEVO' : 'ACUMULADO';
    console.log(`  #${order.number} ${nombre} | $${total.toLocaleString('es-AR')} | ${status}`);
  }

  console.log(`\n✅ Importación completa`);
  console.log(`   Nuevos clientes: ${inserted}`);
  console.log(`   Acumulados (LTV): ${updated}`);
  console.log(`   Saltados (sin tel): ${skipped}`);

  await db.end();
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
