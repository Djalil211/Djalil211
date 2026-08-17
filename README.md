# 🎬 aivideo — توليد فيديو واقعي بالذكاء الاصطناعي

أداة سطر أوامر بلغة Python تولّد **فيديوهات واقعية** عبر أقوى النماذج المتاحة
(Veo 3.1، Kling 2.5، Hailuo، Seedance، Wan) من خلال مزوّدَي **Replicate** و **fal.ai**.

- ✅ **بدون أي اعتماديات** — Python 3.8+ فقط (urllib من المكتبة القياسية)
- ✅ **محسّن للواقعية** — يبني الـ prompt تلقائياً بلبنات العدسة والإضاءة والحبيبات + negative prompt جاهز
- ✅ **9 نماذج** خلف اختصارات بسيطة، مع توحيد أسماء الحقول بين المزوّدين
- ✅ **`--dry-run`** لمعاينة الطلب قبل دفع أي تكلفة
- ✅ تنزيل تلقائي للفيديو + حفظ ملف JSON بكل تفاصيل التوليد (لإعادة الإنتاج)

---

## ⚡ البدء السريع

```bash
# 1) المفاتيح
cp .env.example .env
# ثم افتح .env وضع مفتاحك (يكفي واحد منهما)

# 2) تحقّق
python3 -m aivideo check

# 3) شاهد النماذج المتاحة
python3 -m aivideo models

# 4) ولّد فيديو
python3 -m aivideo generate "An elderly man drinking mint tea in an old cafe at sunrise" -m kling -d 5
```

النتيجة تُحفظ في `outputs/` كملف `.mp4` مع ملف `.json` مرافق.

### من أين أجلب المفتاح؟

| المزوّد | رابط المفتاح | متغيّر البيئة |
|---|---|---|
| Replicate | <https://replicate.com/account/api-tokens> | `REPLICATE_API_TOKEN` |
| fal.ai | <https://fal.ai/dashboard/keys> | `FAL_KEY` |

> الأداة تقرأ المفاتيح من ملف `.env` تلقائياً، أو من متغيّرات البيئة.
> `.env` مُدرج في `.gitignore` فلن يُرفع أبداً.

---

## 🧠 النماذج

| الاختصار | المزوّد | واقعية | صوت أصلي | صورة→فيديو | التكلفة التقريبية | الأفضل لـ |
|---|---|:---:|:---:|:---:|---|---|
| `veo3` | Replicate | ★★★★★ | ✅ | ✅ | ~$0.15–0.40/ث | حوار، تزامن شفاه، لقطة سينمائية نهائية |
| `veo3-fast` | Replicate | ★★★★☆ | ✅ | ✅ | ~$0.15/ث | التجريب السريع قبل اللقطة النهائية |
| `kling` | Replicate | ★★★★★ | ❌ | ✅ | ~$0.07–0.14/ث | **الافتراضي** — أفضل توازن سعر/واقعية |
| `hailuo` | Replicate | ★★★★☆ | ❌ | ✅ | ~$0.25/فيديو | حركة ديناميكية، ميزانية ثابتة |
| `seedance` | Replicate | ★★★★☆ | ❌ | ✅ | ~$0.03–0.10/ث | توليد عدة نسخ بأقل تكلفة |
| `wan` | Replicate | ★★★★☆ | ✅ | ❌ | ~$0.07/ث | الخيار مفتوح المصدر الأرخص |
| `fal-veo3` / `fal-kling` / `fal-wan` | fal.ai | ★★★★☆+ | حسب النموذج | ❌ | حسب fal | بديل إن كان حسابك على fal |

يمكنك أيضاً تمرير **أي معرّف كامل** غير مُسجَّل في الأداة:

```bash
python3 -m aivideo generate "..." -m bytedance/seedance-1-lite     # Replicate
python3 -m aivideo generate "..." -m fal-ai/minimax/hailuo-02/pro  # fal.ai
```

---

## 📖 الأوامر

```
aivideo models              عرض النماذج المدعومة وتفاصيلها
aivideo check               فحص المفاتيح والإعدادات
aivideo prompt "<فكرة>"     بناء prompt محسّن فقط (بدون توليد، مجّاني)
aivideo generate "<فكرة>"   توليد الفيديو وتنزيله
```

### خيارات `generate`

| الخيار | الافتراضي | الوصف |
|---|---|---|
| `-m, --model` | `kling` | النموذج المستعمل |
| `-d, --duration` | `5` | المدة بالثواني |
| `-a, --aspect` | `16:9` | نسبة العرض: `16:9` / `9:16` / `1:1` |
| `-r, --resolution` | `1080p` | الدقة: `720p` / `1080p` / `4k` |
| `-i, --image` | — | صورة بداية (مسار محلي أو رابط) لوضع صورة→فيديو |
| `-n, --count` | `1` | عدد النسخ المولّدة |
| `-s, --seed` | — | بذرة عشوائية لإعادة إنتاج نفس النتيجة |
| `-o, --output` | `outputs/` | مجلّد الحفظ |
| `--style` | `cinematic` | `documentary` `cinematic` `commercial` `phone` `drone` `interview` `none` |
| `--camera` | — | وصف حركة الكاميرا، مثل `"slow dolly-in"` |
| `--negative` | — | إضافات للـ negative prompt |
| `--no-enhance` | — | عدم إضافة لبنات الواقعية التلقائية |
| `--no-negative` | — | تعطيل الـ negative prompt الافتراضي |
| `--set KEY=VALUE` | — | تمرير أي حقل خام للنموذج (يقبل JSON) |
| `--dry-run` | — | عرض الطلب دون إرساله — **لا يكلّف شيئاً** |
| `--timeout` | `1800` | أقصى مدة انتظار بالثواني |

---

## 💡 أمثلة

```bash
# فيديو عمودي للسوشيال مع صوت أصلي
python3 -m aivideo generate \
  "POV walking through a crowded night market, lanterns overhead, steam from food stalls" \
  -m veo3 --style phone --aspect 9:16 -d 8

# لقطة إعلانية لمنتج
python3 -m aivideo generate \
  "A glass perfume bottle rotating slowly on a black reflective surface" \
  -m kling --style commercial --camera "slow orbit" --aspect 1:1

# 3 نسخ رخيصة لاختيار الأفضل
python3 -m aivideo generate "Aerial shot over the Atlas mountains at golden hour" \
  -m seedance --style drone --count 3 --seed 42

# تحريك صورة ثابتة
python3 -m aivideo generate "the camera slowly pushes in, subtle wind moves the hair" \
  -m kling --image ./photo.jpg -d 5

# معاينة الطلب فقط (مجّاناً)
python3 -m aivideo generate "..." -m veo3 --dry-run

# تمرير حقل خاص بالنموذج
python3 -m aivideo generate "..." -m veo3 --set generate_audio=true --set fps=30
```

---

## 🎯 قواعد الواقعية

1. **اكتب الوصف بالإنجليزية** — النماذج مدرّبة عليها؛ العربية تعمل لكن بدقّة أقل (الأداة تنبّهك).
2. **حركة واحدة لكل لقطة** — الأفعال المتزامنة تكسر النموذج.
3. **حدّد الضوء** — `soft window light from the left` أفضل بكثير من `good lighting`.
4. **العيوب = واقعية** — اهتزاز خفيف، حبيبات، غبار في الهواء. الكمال يبدو اصطناعياً.
5. **5 ثوانٍ أفضل من 10** — المدة الأطول تزيد التشوّه.
6. **ابدأ رخيصاً** — جرّب بـ `veo3-fast`/`seedance`، ثم أعد بنفس الـ `--seed` على `veo3`/`kling`.

مكتبة prompts جاهزة: [`prompts/examples.md`](prompts/examples.md)

---

## 🧪 الاختبارات

```bash
python3 -m tests.test_aivideo
```

اختبارات بدون شبكة تغطي بناء الـ prompt، خرائط حقول النماذج، استخراج روابط الفيديو، والـ CLI.

---

## 🗂 بنية المشروع

```
aivideo/
├── cli.py              واجهة سطر الأوامر
├── models.py           سجل النماذج + توحيد أسماء الحقول
├── prompt.py           بناء وتحسين الـ prompt
├── http.py             طبقة HTTP (urllib + إعادة محاولة أسّية)
└── providers/
    ├── base.py         الواجهة المشتركة + استخراج روابط الفيديو
    ├── replicate.py    Replicate predictions API
    └── fal.py          fal.ai queue API
prompts/examples.md     مكتبة prompts جاهزة
tests/                  اختبارات بدون شبكة
outputs/                الفيديوهات المولّدة (متجاهَل في git)
```

---

## ⚠️ ملاحظات

- التوليد **مدفوع** حسب تسعير المزوّد — استعمل `--dry-run` وابدأ بنماذج رخيصة.
- التوليد يستغرق عادة **1–5 دقائق** للمقطع الواحد؛ الأداة تستعلم عن الحالة تلقائياً.
- الفيديوهات المولّدة تُستثنى من git (`outputs/`, `*.mp4`) لتجنّب تضخيم المستودع.
- استعمل الأداة بمسؤولية: لا تولّد محتوى ينتحل شخصية أحد أو يضلّل.
