// Cruce puntual: 3 teléfonos de leads de WhatsApp (04/08 y 07/08) contra órdenes reales de TN.
// CORRER DESDE TU PROPIA TERMINAL (no vía Claude): ahí el token no se sanitiza.
//
// Paso previo (una vez): vercel env pull .env.vercel.production --environment=production
// Uso: node scripts\cruce_leads_pendiente.js
const fs = require('fs');
const envContent = fs.readFileSync('.env.vercel.production', 'utf8');
const TN_STORE = envContent.match(/^TN_STORE_ID="?([^"\n]+)"?/m)[1];
const TN_TOKEN = envContent.match(/^TN_ACCESS_TOKEN="?([^"\n]+)"?/m)[1];
const UA = 'Micelium/1.0 (nahuelp182@gmail.com)';

const telefonos = {
  '5491151336500': '04/08 - pidió manual antes de comprar, no compró en el chat',
  '5493415607686': '07/08 - llegó al link de compra, pidió descuento después',
  '5491136672707': '07/08 23:30 - preguntó envío/compra, mensaje nuevo',
};

const last8 = s => (s || '').replace(/\D/g, '').slice(-8);

async function buscarOrdenesPorTelefono(tel) {
  const t8 = last8(tel);
  const encontradas = [];
  for (let page = 1; page <= 6; page++) {
    const res = await fetch(
      `https://api.tiendanube.com/v1/${TN_STORE}/orders?status=any&per_page=50&page=${page}&fields=number,status,payment_status,created_at,contact_name,contact_phone`,
      { headers: { Authentication: `bearer ${TN_TOKEN}`, 'User-Agent': UA } },
    );
    if (!res.ok) {
      console.error(`  [ERROR] TN respondió ${res.status} en page=${page}: ${await res.text()}`);
      break;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    for (const o of data) {
      if (last8(o.contact_phone || '') === t8) encontradas.push(o);
    }
    if (data.length < 50) break;
  }
  return encontradas;
}

async function main() {
  for (const [tel, ctx] of Object.entries(telefonos)) {
    console.log(`\n=== ${tel} (${ctx}) ===`);
    const ordenes = await buscarOrdenesPorTelefono(tel);
    if (ordenes.length === 0) {
      console.log('  SIN ORDEN encontrada por teléfono en TN (barrido 300 más recientes)');
    } else {
      ordenes.forEach(o =>
        console.log(`  #${o.number} | status=${o.status} | payment=${o.payment_status} | ${o.created_at} | ${o.contact_name} | ${o.contact_phone}`),
      );
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
