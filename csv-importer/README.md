# CSV Product Importer

استيراد المنتجات من ملف CSV إلى WooCommerce أو Shopify.

## صيغة CSV

```csv
name,price,description,short_description,image,sku,category_id
كريم مرطب,120,وصف المنتج,وصف قصير,https://example.com/image.jpg,COS-001,12
```

## التحويل

```bash
node csv-to-json.js input.csv output.json
```

## الاستخدام

```bash
cp output.json ../woocommerce-importer/products.json
```

أو

```bash
cp output.json ../shopify-importer/products.json
```
