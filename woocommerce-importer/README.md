# 🚀 WooCommerce Cosmetic Product Importer v2.0

**عبقري ذكي سريع وآمن** — استيراد آمن لمنتجات مستحضرات التجميل إلى WooCommerce كمسودات Draft.

## 🎯 المميزات

✨ **ذكية وآمنة**:
- استيراد المنتجات كـ `draft` افتراضيًا (لا تنشر مباشرة)
- معالجة الأخطاء الذكية
- تقارير مفصلة

⚡ **سريعة**:
- معالجة دفعات (batch processing)
- تأخير قابل للتكوين بين الطلبات
- عمليات متوازية آمنة

🔍 **شفافة**:
- وضع جاف (dry-run) للمراجعة
- سجلات مفصلة وملونة
- تحقق من الصحة (validator)

## 🛠️ التثبيت السريع

```bash
npm install
cp .env.example .env
# ✏️ عدّل .env
```

## 📝 إعداد .env

```env
WOOCOMMERCE_URL=https://your-store.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxxx
WC_CATEGORY_ID=12
IMPORT_STATUS=draft
BATCH_SIZE=5
DELAY_MS=1000
VERBOSE=true
```

### كيفية الحصول على المفاتيح:

1. اذهب إلى WordPress Admin
2. WooCommerce → Settings → Advanced → REST API
3. اضغط Add key
4. اختر Permissions: Write
5. انسخ Consumer Key و Consumer Secret

## 📦 إعداد products.json

```json
[
  {
    "name": "اسم المنتج",
    "price": "120.00",
    "description": "وصف المنتج",
    "short_description": "وصف قصير",
    "image": "https://example.com/image.jpg",
    "sku": "COS-001",
    "category_id": 12
  }
]
```

## 🚀 الاستخدام

### 1️⃣ التحقق من الصحة
```bash
npm run validate
```

### 2️⃣ المراجعة الجافة (Dry Run)
```bash
npm run dry-run
```

### 3️⃣ الاستيراد الفعلي
```bash
npm run import
```

## 📊 النتائج

بعد الاستيراد، ستجد ملف `import-results.json` يحتوي على:
- عدد المنتجات المستوردة
- عدد الأخطاء
- تفاصيل كل منتج

## ⚠️ ملاحظات مهمة

🚫 **لا تستخدم**:
- صور محمية بحقوق النشر
- محتوى مسروق من مواقع أخرى
- بيانات بدون إذن قانوني

✅ **استخدم فقط**:
- صور ونصوص لديك حق استخدامها
- بيانات من ملفات CSV/JSON موثوقة
- محتوى مرخص أو مملوك لك

## 🔒 الأمان

- لا تضع `.env` في GitHub
- استخدم مفاتيح API محدودة الصلاحية
- ابدأ بـ `draft` قبل النشر
- راجع المنتجات قبل النشر العام

## 🐛 استكشاف الأخطاء

```bash
# إذا كانت البيانات غير صحيحة
npm run validate

# معاينة بدون نشر
npm run dry-run

# بطء الاستيراد؟ اضبط BATCH_SIZE و DELAY_MS في .env
```

## 📞 الدعم

إذا واجهت مشكلة:
1. تأكد من بيانات `.env`
2. تحقق من صحة `products.json`
3. اختبر مع dry-run أولاً

---

**مصنوع بذكاء وعبقرية** ✨
