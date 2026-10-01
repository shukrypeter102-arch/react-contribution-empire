# Shopify Cosmetic Product Importer

يستورد منتجات مستحضرات التجميل المصرح باستخدام بياناتها إلى Shopify كمسودات (`DRAFT`).

## المتطلبات

- متجر Shopify بصلاحية Admin API مخصصة.
- Access token بصلاحية `write_products` فقط عند الحاجة.
- بيانات منتجات تملك حق استخدام أسمائها وأوصافها وصورها.
- Node.js 18 أو أحدث.

## الإعداد

```bash
cd shopify-importer
npm install
cp .env.example .env
```

عدّل `.env` محليًا فقط:

```env
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxxx
SHOPIFY_API_VERSION=2025-10
IMPORT_STATUS=DRAFT
BATCH_SIZE=5
DELAY_MS=1000
```

لا ترفع `.env` إلى GitHub.

## صيغة products.json

```json
[
  {
    "name": "كريم مرطب للبشرة",
    "price": "120.00",
    "description": "وصف مرخص للمنتج",
    "short_description": "كريم مرطب للبشرة",
    "image": "https://example.com/licensed-image.jpg",
    "sku": "COS-001",
    "vendor": "اسم العلامة",
    "product_type": "مستحضرات تجميل",
    "tags": ["cosmetics", "skincare"]
  }
]
```

## التشغيل

```bash
npm run validate
npm run dry-run
npm run import
```

ينشئ المستورد المنتجات بحالة `DRAFT` افتراضيًا، ولا ينشرها تلقائيًا.

## الأمان والامتثال

- لا تستخدم صورًا أو أوصافًا من alfouadpharmacies.com أو أي موقع آخر إلا بإذن أو ترخيص.
- لا ترسل Access Token في المحادثة أو تحفظه في Git.
- ابدأ بمتجر تجريبي وراجع المنتجات قبل النشر.
- لا تغيّر `IMPORT_STATUS` إلى `ACTIVE` إلا بعد المراجعة.
