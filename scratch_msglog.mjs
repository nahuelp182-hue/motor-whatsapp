import pg from 'pg';
import fs from 'fs';
const env = fs.readFileSync('.env.local','utf8');
const url = env.match(/DATABASE_URL=(.*)/)[1].trim().replace(/^["']|["']$/g,'');
const c = new pg.Client({ connectionString: url, ssl:{rejectUnauthorized:false} });
await c.connect();
const q = await c.query(`
  SELECT ml.id, ml.tipo_evento, ml.estado, ml."createdAt", cu.nombre, cu.telefono, ml.error_details
  FROM "MessageLog" ml
  LEFT JOIN "Customer" cu ON cu.id = ml.customer_id
  WHERE ml.tipo_evento IN ('cart_recovery_1','cart_recovery_2','review_request')
  ORDER BY ml."createdAt" DESC LIMIT 50;
`);
console.log('rows:', q.rowCount);
for (const r of q.rows) console.log(r.createdAt?.toISOString(), r.tipo_evento, r.estado, '|', r.nombre, r.telefono, r.error_details||'');
await c.end();
