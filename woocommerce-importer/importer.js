#!/usr/bin/env node

const axios = require('axios');
const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config();

const {
  WOOCOMMERCE_URL,
  WOOCOMMERCE_CONSUMER_KEY,
  WOOCOMMERCE_CONSUMER_SECRET,
  WC_CATEGORY_ID = '12',
  IMPORT_STATUS = 'draft',
  BATCH_SIZE = '5',
  DELAY_MS = '1000',
  VERBOSE = 'true',
} = process.env;

const required = ['WOOCOMMERCE_URL', 'WOOCOMMERCE_CONSUMER_KEY', 'WOOCOMMERCE_CONSUMER_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Error: Missing ${key} in .env file`);
    process.exit(1);
  }
}

const config = {
  baseURL: WOOCOMMERCE_URL.replace(/\/$/, '') + '/wp-json/wc/v3',
  auth: {
    username: WOOCOMMERCE_CONSUMER_KEY,
    password: WOOCOMMERCE_CONSUMER_SECRET,
  },
  categoryId: Number(WC_CATEGORY_ID) || 12,
  status: IMPORT_STATUS,
  batchSize: Number(BATCH_SIZE) || 5,
  delayMs: Number(DELAY_MS) || 1000,
  dryRun: process.argv.includes('--dry-run'),
  verbose: VERBOSE === 'true',
  fileName: process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : 'products.json',
};

const log = (msg, level = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '🔵',
    success: '✅',
    error: '❌',
    warn: '⚠️',
    debug: '🔍',
  }[level] || '📝';
  console.log(`${prefix} [${timestamp}] ${msg}`);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitize(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function buildProductPayload(item) {
  const name = sanitize(item.name || item.title);
  const price = Number(String(item.price).replace(/[^0-9.]/g, ''));

  if (!name) throw new Error('Product name is required');
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid price for "${name}"`);

  const payload = {
    name,
    type: 'simple',
    status: config.status,
    regular_price: price.toFixed(2),
    description: sanitize(item.description || ''),
    short_description: sanitize(item.short_description || item.description || '').slice(0, 500),
    sku: sanitize(item.sku || ''),
  };

  const catId = Number(item.category_id || config.categoryId);
  if (Number.isInteger(catId) && catId > 0) {
    payload.categories = [{ id: catId }];
  }

  if (item.image && String(item.image).trim()) {
    payload.images = [{ src: String(item.image).trim() }];
  }

  return payload;
}

async function importProduct(client, item, index, total) {
  try {
    const payload = buildProductPayload(item);

    if (config.dryRun) {
      log(`[${index}/${total}] DRY RUN: "${payload.name}" @ ${payload.regular_price} ${config.status}`, 'debug');
      return { ok: true, name: payload.name, dryRun: true, skipped: false };
    }

    const { data } = await client.post('/products', payload, { timeout: 30000 });
    log(`[${index}/${total}] ✨ Imported "${data.name}" (ID: #${data.id}) with status: ${data.status}`, 'success');
    return {
      ok: true,
      id: data.id,
      name: data.name,
      status: data.status,
      skipped: false,
    };
  } catch (error) {
    const errorMsg = error.response?.data?.message || error.response?.data || error.message;
    log(`[${index}/${total}] Failed "${item.name || '(unnamed)'": ${errorMsg}`, 'error');
    return {
      ok: false,
      name: item.name || '(unnamed)',
      error: String(errorMsg),
      skipped: false,
    };
  }
}

async function main() {
  try {
    log(`Starting WooCommerce Product Importer v2.0`, 'info');
    log(`Configuration: Status=${config.status}, Category=${config.categoryId}, BatchSize=${config.batchSize}`, 'debug');

    const filePath = path.resolve(process.cwd(), config.fileName);
    if (!fs.existsSync) {
      const fileContent = await fs.readFile(filePath, 'utf8');
    }

    const fileContent = await fs.readFile(filePath, 'utf8');
    const items = JSON.parse(fileContent);

    if (!Array.isArray(items)) {
      throw new Error('Input file must contain a valid JSON array');
    }

    if (items.length === 0) {
      log('No products found in file', 'warn');
      return;
    }

    log(`Loaded ${items.length} products from ${config.fileName}`, 'info');

    const client = axios.create({
      baseURL: config.baseURL,
      auth: config.auth,
    });

    // Validate connection
    try {
      await client.get('/system/status');
      log('✓ Connected to WooCommerce API', 'success');
    } catch (error) {
      throw new Error(`Cannot connect to WooCommerce API: ${error.message}`);
    }

    const results = [];
    const totalBatches = Math.ceil(items.length / config.batchSize);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * config.batchSize;
      const end = Math.min(start + config.batchSize, items.length);
      const batch = items.slice(start, end);

      log(`Processing batch ${batchIndex + 1}/${totalBatches} (${start + 1}-${end}/${items.length})`, 'info');

      const batchResults = await Promise.all(
        batch.map((item, idx) => importProduct(client, item, start + idx + 1, items.length))
      );

      results.push(...batchResults);

      if (batchIndex < totalBatches - 1 && !config.dryRun) {
        log(`Waiting ${config.delayMs}ms before next batch...`, 'debug');
        await sleep(config.delayMs);
      }
    }

    // Save results
    const summary = {
      timestamp: new Date().toISOString(),
      dryRun: config.dryRun,
      total: items.length,
      imported: results.filter((r) => r.ok && !r.dryRun).length,
      failed: results.filter((r) => !r.ok).length,
      dryRunCount: results.filter((r) => r.dryRun).length,
      results,
    };

    await fs.writeFile('import-results.json', JSON.stringify(summary, null, 2));

    log(`\n${'='.repeat(60)}`, 'info');
    log(`Import Summary:`, 'info');
    log(`Total Products: ${summary.total}`, 'info');
    log(`Successfully Imported: ${summary.imported}`, summary.imported > 0 ? 'success' : 'warn');
    log(`Failed: ${summary.failed}`, summary.failed > 0 ? 'error' : 'success');
    log(`Dry Run: ${summary.dryRunCount}`, 'debug');
    log(`Results saved to: import-results.json`, 'info');
    log(`${'='.repeat(60)}\n`, 'info');

    if (summary.failed > 0) process.exitCode = 1;
  } catch (error) {
    log(`Fatal error: ${error.message}`, 'error');
    process.exitCode = 1;
  }
}

main();
