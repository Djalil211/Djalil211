# سباق الراية — Arab Flag Race

واجهة أولية تفاعلية ومتجاوبة للعبة سباق أعلام الدول العربية، مصممة للهاتف وتعمل كتطبيق ويب/PWA.

## التشغيل

لا تحتاج مكتبات أو خادم بناء. من جذر المشروع:

```bash
python3 -m http.server 4173 --bind 0.0.0.0
```

ثم افتح `http://localhost:4173`، أو استخدم معاينة Arena. يمكن تثبيت الصفحة على Android من قائمة المتصفح **إضافة إلى الشاشة الرئيسية**. أضفت Service Worker وmanifest وأيقونة لتعمل كتطبيق PWA حتى دون اتصال بعد أول فتح.

## الموجود في النموذج

- 23 دولة عربية، مع اختيار 14 متسابقاً في كل جولة.
- سباق حي بصري مع عدّاد 45 ثانية، خلط، إعادة، وفائز عشوائي.
- مكتبة أعلام قابلة للتبديل قبل بداية الجولة.
- أصوات إشعار/نطق الهدية مع زر كتم الصوت.
- لوحة TikTok LIVE لحفظ اسم المستخدم، وحالة اتصال تجريبية.
- هدايا تفاعلية: وردة، دونات، دايموند، وأسَد؛ النقر يحاكي وصول الهدية في موجز البث.
- تصميم RTL responsive مناسب لشاشات Android وPWA.

## الربط الحقيقي وAPK

النموذج الحالي لا ينتحل TikTok ولا يخزن مفاتيح. الربط المباشر يحتاج Backend آمن وتطبيق TikTok LIVE الرسمي/صلاحيات Webhooks المتاحة لحسابك؛ لا تضع client secret في JavaScript المتصفح. عند توفير الاعتماد الرسمي يمكن تحويل أحداث `gift` إلى `sendGift()` في `app.js` عبر WebSocket/SSE.

لبناء APK إنتاجي، يُغلف نفس الواجهة عبر Capacitor بعد إضافة مشروع Android:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "سباق الراية" com.arabflag.race --web-dir .
npx cap add android
npx cap copy android
npx cap open android
```

ثم اختر **Build > Generate Signed Bundle / APK** في Android Studio. يلزم تثبيت Android SDK وJDK وإضافة أي Backend TikTok قبل النشر.
