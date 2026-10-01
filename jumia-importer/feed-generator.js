#!/usr/bin/env node

const fs = require('node:fs/promises');

async function generateXmlFeed(jsonFile, xmlFile) {
  const content = await fs.readFile(jsonFile, 'utf8');
  const products = JSON.parse(content);

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Products>\n';

  for (const product of products) {
    xml += `  <Product>\n`;
    xml += `    <Title>${escapeXml(product.name)}</Title>\n`;
    xml += `    <Description>${escapeXml(product.description)}</Description>\n`;
    xml += `    <Price>${product.price}</Price>\n`;
    xml += `    <SKU>${escapeXml(product.sku)}</SKU>\n`;
    if (product.image) xml += `    <Image>${escapeXml(product.image)}</Image>\n`;
    xml += `  </Product>\n`;
  }

  xml += '</Products>';
  await fs.writeFile(xmlFile, xml);
  console.log(`Generated XML feed with ${products.length} products`);
}

function escapeXml(str) {
  return String(str).replace(/[<>&'\"]/g, char => {
    const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' };
    return entities[char];
  });
}

const args = process.argv.slice(2);
if (args.length < 2) throw new Error('Usage: node feed-generator.js input.json output.xml');

generateXmlFeed(args[0], args[1]).catch(error => { console.error(`Error: ${error.message}`); process.exit(1); });
