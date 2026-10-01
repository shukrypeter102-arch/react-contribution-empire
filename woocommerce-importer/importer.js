const axios = require('axios');
const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config();

const required = ['WOOCOMMERCE_URL', 'WOOCOMMERCE_CONSUMER_KEY', 'WOOCOMMERCE_CONSUMER_SECRET'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key} in .env`);
}

const baseURL = process.env.WOOCOMMERCE_URL.replace(/\\/$/, '') + '/wp-json/wc/v3';
const auth = {
  username: process.env.WOOCOMMERCE_CONSUMER_KEY,
  password: process.env.WOOCOMMERCE_CONSUMER_SECRET,
};
const defaultCategoryId = process.env.WC_CATEGORY_ID ? Number(process.env.WC_CATEGORY_ID) : undefined;
const status = process.env.IMPORT_STATUS || 'draft';
const dryRun = process.argv.includes('--dry-run');
const fileArgIndex = process.argv.indexOf('--file');
const fileName = fileArgIndex >= 0 ? process.argv[fileArgIndex + 1] : 'products.json';

function clean(value) {
  return String(value ?? '').replace(/\\s+/g, ' ').trim();
}

function productPayload(item) {
  const name = clean(item.name || item.title);
  const price = Number(String(item.price).replace(/[^0-9.]/g, ''));
  if (!name) throw new Error('Product name is required');
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid price for ${name}`);

  const payload = {
    name,
    type: 'simple',
    status,
    regular_price: price.toFixed(2),
    description: clean(item.description),
    short_description: clean(item.short_description || item.description).slice(0, 500),
    sku: clean(item.sku),
  };

  const categoryId = Number(item.category_id || defaultCategoryId);
  if (Number.isInteger(categoryId) && categoryId > 0) payload.categories = [{ id: categoryId }];
  if (item.image) payload.images = [{ src: String(item.image).trim() }];
  return payload;
}

async function main() {
  const fullPath = path.resolve(process.cwd(), fileName);
  const items = JSON.parse(await fs.readFile(fullPath, 'utf8'));
  if (!Array.isArray(items)) throw new Error('Input file must contain a JSON array');

  const results = [];
  for (const item of items) {
    try {
      const payload = productPayload(item);
      if (dryRun) {
        console.log('[DRY RUN]', payload.name, payload.regular_price);
        results.push({ ok: true, name: payload.name, dryRun: true });
        continue;
      }
      const response = await axios.post(`${baseURL}/products`, payload, { auth, timeout: 30000 });
      console.log('[IMPORTED]', response.data.name, `#${response.data.id}`);
      results.push({ ok: true, id: response.data.id, name: response.data.name });
    } catch (error) {
      const detail = error.response?.data?.message || error.response?.data || error.message;
      console.error('[FAILED]', item.name || item.title || '(unnamed)', detail);
      results.push({ ok: false, name: item.name || item.title, error: String(detail) });
    }
  }
  await fs.writeFile('import-results.json', JSON.stringify(results, null, 2));
  const failed = results.filter((result) => !result.ok).length;
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
