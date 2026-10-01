#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config();

const log = (msg, level = 'info') => {
  const prefix = {
    info: '🔵',
    success: '✅',
    error: '❌',
    warn: '⚠️',
  }[level] || '📝';
  console.log(`${prefix} ${msg}`);
};

async function validateEnv() {
  log('\n📋 Validating .env file...', 'info');
  const required = ['WOOCOMMERCE_URL', 'WOOCOMMERCE_CONSUMER_KEY', 'WOOCOMMERCE_CONSUMER_SECRET'];
  let valid = true;
  for (const key of required) {
    if (process.env[key]) {
      log(`${key}: ✓`, 'success');
    } else {
      log(`${key}: Missing!`, 'error');
      valid = false;
    }
  }
  return valid;
}

async function validateProducts() {
  log('\n📦 Validating products.json...', 'info');
  try {
    const content = await fs.readFile(path.resolve(process.cwd(), 'products.json'), 'utf8');
    const products = JSON.parse(content);

    if (!Array.isArray(products)) {
      log('products.json must be an array', 'error');
      return false;
    }

    if (products.length === 0) {
      log('products.json is empty', 'warn');
      return true;
    }

    let valid = true;
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      if (!product.name) {
        log(`Product ${i + 1}: Missing name`, 'error');
        valid = false;
      }
      if (!product.price) {
        log(`Product ${i + 1}: Missing price`, 'error');
        valid = false;
      }
    }

    if (valid) {
      log(`Found ${products.length} valid products`, 'success');
    }

    return valid;
  } catch (error) {
    log(`Error reading products.json: ${error.message}`, 'error');
    return false;
  }
}

async function main() {
  const envValid = await validateEnv();
  const productsValid = await validateProducts();

  if (envValid && productsValid) {
    log('\n✨ All validations passed! Ready to import.', 'success');
    log('Run: npm run dry-run (to preview)', 'info');
    log('Run: npm run import (to execute)', 'info');
    return;
  }

  log('\n❌ Validation failed. Please fix the issues above.', 'error');
  process.exit(1);
}

main();
