# مكتبة prompts جاهزة لفيديو واقعي

انسخ أي سطر واستعمله مباشرة:

```bash
python3 -m aivideo generate "<الـ prompt هنا>" -m kling -d 5
```

> نصيحة: اكتب الوصف بالإنجليزية — نماذج الفيديو مدرّبة عليها وتعطي دقّة أعلى بكثير.

---

## 1. أشخاص (الأصعب واقعياً)

| المشهد | الـ prompt |
|---|---|
| رجل مسنّ في مقهى | `An elderly man with deep wrinkles sits alone at a worn wooden table in a old North African cafe, slowly lifting a small glass of mint tea, steam rising, warm morning light through a dusty window, he blinks and exhales` |
| مقابلة شارع | `A young woman in a denim jacket speaks to camera on a busy sidewalk, people walking behind her out of focus, she gestures with her hands, overcast daylight, slight handheld shake` |
| طفل يضحك | `A child laughing while running through a garden sprinkler on a hot afternoon, water droplets catching sunlight, hair sticking to forehead, slow motion` |
| يد تكتب | `Extreme close-up of a hand writing with a fountain pen on textured paper, ink flowing, desk lamp light from the left, dust particles in the air` |

**النموذج المقترح:** `kling` أو `veo3` (إن أردت صوتاً/حواراً).

## 2. مناظر طبيعية وجوّية

| المشهد | الـ prompt |
|---|---|
| جبال الأطلس | `Aerial drone shot gliding over the Atlas mountains at golden hour, long shadows across ridgelines, thin haze in the valleys, slow forward push` |
| موج | `Slow motion ocean wave curling and breaking on dark volcanic sand, backlit by low sun, spray suspended in the air` |
| مدينة ليلاً | `Time-lapse of a city intersection at night, light trails from traffic, neon reflections on wet asphalt after rain` |

**النموذج المقترح:** `hailuo` أو `seedance` (الأرخص) — `--style drone`.

## 3. منتجات وإعلانات

| المشهد | الـ prompt |
|---|---|
| عطر | `A glass perfume bottle rotating slowly on a black reflective surface, single soft key light raking across the glass, subtle caustics, studio product cinematography` |
| قهوة تُسكب | `Macro shot of espresso pouring into a white ceramic cup, crema forming, steam curling upward, dark moody kitchen background` |
| ساعة | `Close-up orbit around a stainless steel wristwatch on brushed concrete, light sweeping across the dial, shallow depth of field` |

**النموذج المقترح:** `kling` مع `--style commercial --aspect 1:1`.

## 4. عمودي للسوشيال (Reels / TikTok)

```bash
python3 -m aivideo generate "POV walking through a crowded night market, lanterns overhead, steam from food stalls, handheld phone footage" \
  -m veo3-fast --style phone --aspect 9:16 -d 8
```

## 5. تحريك صورة ثابتة (صورة → فيديو)

```bash
python3 -m aivideo generate "the camera slowly pushes in, subtle wind moves the hair, natural blinking" \
  -m kling --image ./photo.jpg -d 5
```

---

## قواعد ذهبية للواقعية

1. **اذكر الكاميرا والعدسة** — `35mm lens, shallow depth of field` (الأداة تضيفها تلقائياً).
2. **اذكر مصدر الضوء** — `soft window light from the left`, `single key light`.
3. **حركة واحدة فقط لكل لقطة** — النماذج تفشل مع أفعال متعددة متزامنة.
4. **أضف عيوباً واقعية** — `slight handheld shake`, `film grain`, `dust in the air`. الكمال = مظهر اصطناعي.
5. **حدّد حركة الكاميرا** بـ `--camera "slow dolly-in"` بدل تركها للنموذج.
6. **ابدأ رخيصاً** — جرّب بـ `veo3-fast` أو `seedance`، ثم أعد التوليد النهائي بنفس الـ `--seed` على `veo3` أو `kling`.
7. **5 ثوانٍ أفضل من 10** — كلّما طالت المدة زاد احتمال التشوّه والانزلاق.
