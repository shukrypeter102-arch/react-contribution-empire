# WooCommerce Cosmetic Importer

يستورد منتجات مستحضرات التجميل المصرح باستخدام بياناتها إلى WooCommerce كمسودات (`draft`).

## تشغيل سريع

```bash
cd woocommerce-importer
npm install
cp .env.example .env
# عدّل .env محليًا، ولا ترفعه إلى GitHub
npm run import -- --file products.json --dry-run
npm run import -- --file products.json
```

> لا تستخدم صورًا أو أوصافًا من موقع آخر إلا إذا كان لديك تصريح أو ترخيص بذلك. استخدم ملف `products.json` لبيانات تملك حق استخدامها.

## صيغة البيانات

```json
[
  {
    "name": "اسم المنتج",
    "price": "120.00",
    "description": "وصف مرخص للمنتج",
    "short_description": "وصف مختصر",
    "image": "https://example.com/licensed-image.jpg",
    "sku": "COS-001",
    "category_id": 12
  }
]
```

جميع المنتجات تُنشأ كمسودات افتراضيًا. لا يتم نشرها تلقائيًا.
