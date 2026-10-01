require('dotenv').config();
const fs = require('node:fs/promises');
const path = require('node:path');

async function main() {
  const missing = ['SALLA_MERCHANT_ID', 'SALLA_ACCESS_TOKEN'].filter(key => !process.env[key]);
  if (missing.length) throw new Error(`Missing in .env: ${missing.join(', ')}`);
  const file = path.resolve(process.cwd(), 'products.json');
  const products = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!Array.isArray(products)) throw new Error('products.json must contain an array');
  console.log(`✅ Valid configuration and ${products.length} product(s).`);
}

main().catch(error => { console.error(`❌ Validation failed: ${error.message}`); process.exit(1); });
