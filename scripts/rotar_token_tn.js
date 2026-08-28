// Lee el token de Tiendanube recién guardado en la DB (por el callback OAuth) y lo sube
// a Vercel como TN_ACCESS_TOKEN de producción, SIN imprimirlo en pantalla ni pasar por
// ningún chat: va directo de la DB al stdin de `vercel env add`.
//
// Requisito previo: haber reautorizado la app en Tiendanube (el callback en
// /api/auth/tiendanube/callback ya corrió y actualizó Store.tiendanube_access_token).
//
// Uso: node scripts\rotar_token_tn.js
const fs = require('fs');
const { execSync } = require('child_process');
const { Client } = require('pg');

const envContent = fs.readFileSync('.env.local', 'utf8');
const DATABASE_URL = envContent.match(/^DATABASE_URL="([^"]+)"/m)[1];

async function main() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // Sin filtro por tiendanube_store_id: hoy hay una sola fila (tienda propia). Si en el
  // futuro hay más de una, hay que volver a filtrar explícitamente.
  const res = await client.query(`SELECT tiendanube_access_token FROM "Store"`);
  await client.end();

  if (res.rows.length > 1) {
    console.error(`Hay ${res.rows.length} filas en Store — no se puede elegir sola. Filtrá manualmente.`);
    process.exit(1);
  }

  if (res.rows.length === 0) {
    console.error('No se encontró ninguna fila en Store con ese tiendanube_store_id. ¿Reautorizaste la app?');
    process.exit(1);
  }

  const token = res.rows[0].tiendanube_access_token;
  if (!token) {
    console.error('La fila existe pero tiendanube_access_token está vacío. El callback OAuth no corrió aún.');
    process.exit(1);
  }

  console.log('Token encontrado en la DB. Subiendo a Vercel...');

  // Saca la env var vieja (puede fallar si no existe, no importa) y crea la nueva desde stdin.
  try {
    execSync('npx vercel env rm TN_ACCESS_TOKEN production --yes', { stdio: 'inherit' });
  } catch {
    // no existía o falló el rm: seguimos igual, `add` puede pedir confirmación de sobreescritura
  }

  execSync('npx vercel env add TN_ACCESS_TOKEN production', {
    input: token,
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  console.log('\nListo. Ahora redeployá con: npx vercel --prod');
}

main().catch(e => { console.error(e); process.exit(1); });
