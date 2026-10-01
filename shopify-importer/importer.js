const axios = require('axios');
const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config();

const required = ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_ADMIN_ACCESS_TOKEN'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key} in .env`);
}

const domain = process.env.SHOPIFY_STORE_DOMAIN.replace(/^https?:\\/\\//, '').replace(/\\/$/, '');
const version = process.env.SHOPIFY_API_VERSION || '2025-10';
const endpoint = `https://${domain}/admin/api/${version}/graphql.json`;
const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const status = process.env.IMPORT_STATUS || 'DRAFT';
const batchSize = Number(process.env.BATCH_SIZE || 5);
const delayMs = Number(process.env.DELAY_MS || 1000);
const dryRun = process.argv.includes('--dry-run');
const fileArg = process.argv.indexOf('--file');
const fileName = fileArg >= 0 ? process.argv[fileArg + 1] : 'products.json';

const CREATE_PRODUCT = `mutation CreateProduct($input: ProductInput!, $media: [CreateMediaInput!]) { productCreate(product: $input, media: $media) { product { id title status handle } userErrors { field message } } }`;

function clean(value) {
  return String(value ?? '').replace(/\\s+/g, ' ').trim();
}

function buildInput(item) {
  const title = clean(item.name || item.title);
  const price = Number(String(item.price).replace(/[^0-9.]/g, ''));
  if (!title) throw new Error('Product name is required');
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid price for ${title}`);

  const description = clean(item.description || item.short_description);
  const input = {
    title,
    descriptionHtml: description ? `<p>${description.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>` : '',
    status,
    vendor: clean(item.vendor),
    productType: clean(item.product_type || 'Cosmetics'),
    tags: Array.isArray(item.tags) ? item.tags.map(clean).filter(Boolean) : [],
  };

  // productCreate creates a default variant; price/SKU are updated afterwards.
  return { input, price: price.toFixed(2), sku: clean(item.sku), image: clean(item.image) };
}

async function graphql(query, variables) {
  const response = await axios.post(endpoint, { query, variables }, {
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    timeout: 30000,
  });
  if (response.data.errors?.length) throw new Error(JSON.stringify(response.data.errors));
  return response.data.data;
}

async function updateVariant(productId, price, sku) {
  const query = `query ProductVariants($id: ID!) { product(id: $id) { variants(first: 1) { nodes { id } } } }`;
  const data = await graphql(query, { id: productId });
  const variantId = data.product?.variants?.nodes?.[0]?.id;
  if (!variantId) return;
  const mutation = `mutation UpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) { productVariantsBulkUpdate(productId: $productId, variants: $variants) { productVariants { id } userErrors { field message } } }`;
  const result = await graphql(mutation, { productId, variants: [{ id: variantId, price, ...(sku ? { sku } : {}) }] });
  const errors = result.productVariantsBulkUpdate?.userErrors || [];
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function addImage(productId, image) {
  if (!image) return;
  const mutation = `mutation AddMedia($productId: ID!, $media: [CreateMediaInput!]!) { productCreateMedia(productId: $productId, media: $media) { media { id } mediaUserErrors { field message } } }`;
  const result = await graphql(mutation, { productId, media: [{ originalSource: image, mediaContentType: 'IMAGE' }] });
  const errors = result.productCreateMedia?.mediaUserErrors || [];
  if (errors.length) throw new Error(JSON.stringify(errors));
}

async function importOne(item, index, total) {
  const built = buildInput(item);
  if (dryRun) {
    console.log(`[DRY RUN] ${index}/${total} ${built.input.title} (${built.price})`);
    return { ok: true, dryRun: true, name: built.input.title };
  }

  const data = await graphql(CREATE_PRODUCT, { input: built.input });
  const result = data.productCreate;
  if (result.userErrors?.length) throw new Error(JSON.stringify(result.userErrors));
  await updateVariant(result.product.id, built.price, built.sku);
  await addImage(result.product.id, built.image);
  console.log(`[IMPORTED] ${index}/${total} ${result.product.title} (${result.product.id})`);
  return { ok: true, id: result.product.id, name: result.product.title, status: result.product.status };
}

async function main() {
  const filePath = path.resolve(process.cwd(), fileName);
  const products = JSON.parse(await fs.readFile(filePath, 'utf8'));
  if (!Array.isArray(products)) throw new Error('Input file must be a JSON array');

  const results = [];
  for (let start = 0; start < products.length; start += batchSize) {
    const batch = products.slice(start, start + batchSize);
    const batchResults = await Promise.all(batch.map(async (item, offset) => {
      try { return await importOne(item, start + offset + 1, products.length); }
      catch (error) { console.error(`[FAILED] ${item.name || item.title || '(unnamed)'}: ${error.message}`); return { ok: false, name: item.name || item.title, error: error.message }; }
    }));
    results.push(...batchResults);
    if (!dryRun && start + batchSize < products.length) await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  await fs.writeFile('import-results.json', JSON.stringify({ timestamp: new Date().toISOString(), dryRun, total: products.length, results }, null, 2));
  console.log(`Done: ${results.filter(r => r.ok).length} succeeded, ${results.filter(r => !r.ok).length} failed.`);
  if (results.some(r => !r.ok)) process.exitCode = 1;
}

main().catch(error => { console.error(`Fatal: ${error.message}`); process.exitCode = 1; });
