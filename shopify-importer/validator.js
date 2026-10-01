require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const missing = ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ADMIN_ACCESS_TOKEN'].filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing in .env: ${missing.join(', ')}`);
  const file = path.resolve(process.cwd(), 'products.json');
  const products = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!Array.isArray(products)) throw new Error('products.json must contain an array');
  const invalid = products.filter((p, i) => !p.name && !p.title ? i + 1 : (!p.price || Number(String(p.price).replace(/[^0-9.]/g, '')) <= 0) ? i + 1 : 0);
  if (invalid.length) throw new Error(`Invalid products at rows: ${invalid.join(', ')}`);
  console.log(`Valid configuration and ${products.length} product(s).`);
  console.log('Recommended next step: npm run dry-run');
}

main().catch(error => { console.error(`Validation failed: ${error.message}`); process.exitCode = 1; });
