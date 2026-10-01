#!/usr/bin/env node

const axios = require('axios');
const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config();

const required = ['SALLA_MERCHANT_ID', 'SALLA_ACCESS_TOKEN'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key} in .env`);
}

const endpoint = 'https://api.salla.sa/v2/products';
const token = process.env.SALLA_ACCESS_TOKEN;
const status = process.env.IMPORT_STATUS || 'draft';
const batchSize = Number(process.env.BATCH_SIZE || 5);
const delayMs = Number(process.env.DELAY_MS || 1000);
const dryRun = process.argv.includes('--dry-run');
const fileName = process.argv.includes('--file') ? process.argv[process.argv.indexOf('--file') + 1] : 'products.json';

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function buildProduct(item) {
  const name = clean(item.name || item.title);
  const price = Number(String(item.price).replace(/[^0-9.]/g, ''));
  if (!name) throw new Error('Product name is required');
  if (!Number.isFinite(price) || price <= 0) throw new Error(`Invalid price for ${name}`);

  return {
    name,
    description: clean(item.description || ''),
    price: price.toFixed(2),
    sku: clean(item.sku || ''),
    quantity: item.quantity || 100,
    status,
    image: clean(item.image || ''),
  };
}

async function importOne(item, index, total) {
  const product = buildProduct(item);
  if (dryRun) {
    console.log(`[DRY RUN] ${index}/${total} ${product.name} - ${product.price}`);
    return { ok: true, dryRun: true, name: product.name };
  }

  try {
    const response = await axios.post(endpoint, { product }, {
      headers: { 'Authorization': `Bearer ${token}` },
      timeout: 30000,
    });
    console.log(`[IMPORTED] ${index}/${total} ${product.name}`);
    return { ok: true, id: response.data?.data?.id, name: product.name };
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message);
  }
}

async function main() {
  const filePath = path.resolve(process.cwd(), fileName);
  let fileContent;
  try {
    fileContent = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${fileName}: ${error.message}`);
  }

  const products = JSON.parse(fileContent);
  if (!Array.isArray(products)) throw new Error('products.json must be an array');

  const results = [];
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(async (item, offset) => {
      try {
        return await importOne(item, i + offset + 1, products.length);
      } catch (error) {
        console.error(`[FAILED] ${item.name || '(unnamed)'}: ${error.message}`);
        return { ok: false, name: item.name || '(unnamed)', error: error.message };
      }
    }));
    results.push(...batchResults);
    if (!dryRun && i + batchSize < products.length) await new Promise(resolve => setTimeout(resolve, delayMs));
  }

  await fs.writeFile('import-results.json', JSON.stringify({ timestamp: new Date().toISOString(), dryRun, results }, null, 2));
  console.log(`Done: ${results.filter(r => r.ok).length} succeeded, ${results.filter(r => !r.ok).length} failed.`);
}

main().catch(error => { console.error(`Fatal: ${error.message}`); process.exit(1); });
