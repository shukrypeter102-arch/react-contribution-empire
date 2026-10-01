#!/usr/bin/env node

const fs = require('node:fs/promises');
const path = require('node:path');

async function csvToJson(inputFile, outputFile) {
  let content;
  try {
    content = await fs.readFile(inputFile, 'utf8');
  } catch (error) {
    throw new Error(`Cannot read ${inputFile}: ${error.message}`);
  }

  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  if (lines.length < 2) throw new Error('CSV must have header and at least one data row');

  const headers = lines[0].split(',').map(h => h.trim());
  const products = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const product = {};
    for (let j = 0; j < headers.length; j++) {
      product[headers[j]] = values[j];
    }
    products.push(product);
  }

  await fs.writeFile(outputFile, JSON.stringify(products, null, 2));
  console.log(`✅ Converted ${products.length} products to ${outputFile}`);
}

const args = process.argv.slice(2);
if (args.length < 2) throw new Error('Usage: node csv-to-json.js input.csv output.json');

csvToJson(args[0], args[1]).catch(error => { console.error(`❌ Error: ${error.message}`); process.exit(1); });
