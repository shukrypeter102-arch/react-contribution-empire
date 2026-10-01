# Jumia Feed Generator

إنشاء ملف XML feed للمنتجات لمنصة Jumia.

## الاستخدام

```bash
node feed-generator.js products.json output.xml
```

## مثال

```bash
node feed-generator.js ../shopify-importer/products.json jumia-feed.xml
```

## التنسيق

يتم إنشاء ملف XML بصيغة Jumia Feed:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Products>
  <Product>
    <Title>اسم المنتج</Title>
    <Description>وصف المنتج</Description>
    <Price>السعر</Price>
    <SKU>الكود</SKU>
    <Image>رابط الصورة</Image>
  </Product>
</Products>
```
