const axios = require('axios');
const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config();

const required = ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ADMIN_ACCESS_TOKEN'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key} in .env`);
}

const domain = process.env.SHOPIFY_STORE_DOMAIN
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');
const version = process.env.SHOPIFY_API_VERSION || '2025-10';
const endpoint = `https://${domain}/admin/api/${version}/graphql.json`;
const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN.trim();
const status = String(process.env.IMPORT_STATUS || 'DRAFT').toUpperCase();
const batchSize = Number(process.env.BATCH_SIZE || 5);
const delayMs = Number(process.env.DELAY_MS || 1000);
const dryRun = process.argv.includes('--dry-run');
const skipExisting = !process.argv.includes('--allow-duplicates');
const fileArg = process.argv.indexOf('--file');
const fileName = fileArg >= 0 && process.argv[fileArg + 1] ? process.argv[fileArg + 1] : 'products.json';

if (!/^\d{4}-\d{2}$/.test(version)) throw new Error('SHOPIFY_API_VERSION must look like YYYY-MM');
if (!['ACTIVE', 'DRAFT', 'ARCHIVED'].includes(status)) throw new Error('IMPORT_STATUS must be ACTIVE, DRAFT, or ARCHIVED');
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) throw new Error('BATCH_SIZE must be an integer from 1 to 20');
if (!Number.isFinite(delayMs) || delayMs < 0) throw new Error('DELAY_MS must be zero or greater');

const CREATE_PRODUCT = `
  mutation CreateProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
    productCreate(product: $product, media: $media) {
      product { id title status handle }
      userErrors { field message }
    }
  }
`;

const FIND_BY_SKU = `
  query FindBySku($query: String!) {
    products(first: 1, query: $query) {
      nodes { id title status }
    }
  }
`;

const GET_VARIANT = `
  query ProductVariant($id: ID!) {
    product(id: $id) { variants(first: 1) { nodes { id } } }
  }
`;

const UPDATE_VARIANT = `
  mutation UpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id }
      userErrors { field message }
    }
  }
`;

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildProduct(item) {
  const title = clean(item.name || item.title);
  const price = Number(String(item.price ?? '').replace(/[^0-9.]/g, ''));
  const sku = clean(item.sku);
  const image = clean(item.image);

  if (!title) throw new Error('Product name is required');
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid price for "${title}"`);
  if (sku && !/^[^\s]{1,255}$/.test(sku)) throw new Error(`Invalid SKU for "${title}"`);
  if (image) {
    let parsed;
    try { parsed = new URL(image); } catch { throw new Error(`Invalid image URL for "${title}"`); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Image URL must use HTTP(S) for "${title}"`);
  }

  const description = clean(item.description || item.short_description);
  const product = {
    title,
    descriptionHtml: description ? `<p>${escapeHtml(description)}</p>` : '',
    status,
    productType: clean(item.product_type || 'Cosmetics'),
  };
  const vendor = clean(item.vendor);
  if (vendor) product.vendor = vendor;
  if (Array.isArray(item.tags)) product.tags = item.tags.map(clean).filter(Boolean);

  return { product, price: price.toFixed(2), sku, image };
}

async function graphql(query, variables = {}) {
  const response = await axios.post(endpoint, { query, variables }, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    timeout: 30000,
  });
  if (response.data.errors?.length) throw new Error(JSON.stringify(response.data.errors));
  if (!response.data.data) throw new Error('Shopify returned no data');
  return response.data.data;
}

async function findExistingBySku(sku) {
  if (!sku) return null;
  const data = await graphql(FIND_BY_SKU, { query: `sku:${sku.replace(/([\\":])/g, '\\$1')}` });
  return data.products?.nodes?.[0] || null;
}

async function updateVariant(productId, price, sku) {
  const data = await graphql(GET_VARIANT, { id: productId });
  const variantId = data.product?.variants?.nodes?.[0]?.id;
  if (!variantId) throw new Error('Created product has no default variant');

  const result = await graphql(UPDATE_VARIANT, {
    productId,
    variants: [{ id: variantId, price, ...(sku ? { sku } : {}) }],
  });
  const errors = result.productVariantsBulkUpdate?.userErrors || [];
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function importOne(item, index, total) {
  const built = buildProduct(item);
  if (dryRun) {
    console.log(`[DRY RUN] ${index}/${total} ${built.product.title} (${built.price})`);
    return { ok: true, dryRun: true, name: built.product.title };
  }

  if (skipExisting && built.sku) {
    const existing = await findExistingBySku(built.sku);
    if (existing) {
      console.log(`[SKIPPED] ${index}/${total} ${built.product.title}: SKU ${built.sku} already exists`);
      return { ok: true, skipped: true, name: built.product.title, id: existing.id, sku: built.sku };
    }
  }

  const variables = { product: built.product };
  if (built.image) variables.media = [{ originalSource: built.image, mediaContentType: 'IMAGE' }];
  const data = await graphql(CREATE_PRODUCT, variables);
  const result = data.productCreate;
  if (result.userErrors?.length) throw new Error(JSON.stringify(result.userErrors));
  if (!result.product) throw new Error('Shopify did not return a created product');

  await updateVariant(result.product.id, built.price, built.sku);
  console.log(`[IMPORTED] ${index}/${total} ${result.product.title} (${result.product.id})`);
  return { ok: true, id: result.product.id, name: result.product.title, status: result.product.status, sku: built.sku };
}

async function main() {
  const filePath = path.resolve(process.cwd(), fileName);
  const products = JSON.parse(await fs.readFile(filePath, 'utf8'));
  if (!Array.isArray(products) || products.length === 0) throw new Error(`${fileName} must contain a non-empty JSON array`);

  const results = [];
  for (let start = 0; start < products.length; start += batchSize) {
    const batch = products.slice(start, start + batchSize);
    const batchResults = await Promise.all(batch.map(async (item, offset) => {
      try { return await importOne(item, start + offset + 1, products.length); }
      catch (error) {
        const name = item?.name || item?.title || '(unnamed)';
        console.error(`[FAILED] ${name}: ${error.message}`);
        return { ok: false, name, error: error.message };
      }
    }));
    results.push(...batchResults);
    if (!dryRun && start + batchSize < products.length && delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  const summary = {
    timestamp: new Date().toISOString(), dryRun, total: products.length,
    imported: results.filter(r => r.ok && !r.skipped && !r.dryRun).length,
    skipped: results.filter(r => r.skipped).length,
    failed: results.filter(r => !r.ok).length, results,
  };
  await fs.writeFile('import-results.json', JSON.stringify(summary, null, 2));
  console.log(`Done: ${summary.imported} imported, ${summary.skipped} skipped, ${summary.failed} failed.`);
  if (summary.failed) process.exitCode = 1;
}

main().catch(error => { console.error(`Fatal: ${error.message}`); process.exitCode = 1; });
