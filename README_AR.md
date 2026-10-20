# Where I Left Off — وين وصلت؟

[![فحوص الجودة](https://github.com/AdamAbuToamy/where-i-left-off/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/AdamAbuToamy/where-i-left-off/actions/workflows/ci.yml)

**احفظ الرابط، سجّل وين وقفت، وارجع وأنت عارف الخطوة الجاية.**

تطبيق لتنظيم المشاريع والمتابعات، يدعم العربية والعبرية والإنجليزية، ويعمل على الهاتف والكمبيوتر مع مزامنة عبر الحساب وتعديلات محفوظة دون اتصال.

**[جرّب التطبيق](https://where-i-left-off.web.app/)** · **[English](README.md)** · **[نتائج الاختبارات](TEST_RESULTS.md)**

<!-- recall-media:start -->
## عرض تعريفي

<a href="docs/media/README.md"><img src="docs/media/images/resume-ar.png" width="360" alt="ملصق إعلاني لتطبيق وين وصلت"></a>

رسم إعلاني يشرح الفكرة، وليس لقطة شاشة فعلية للتطبيق.

**[الفيديو العربي](docs/media/videos/promo-ar.mp4)** · **[الفيديو الإنجليزي](docs/media/videos/promo-en.mp4)** · **[معرض الصور ودليلا التثبيت](docs/media/README.md)**

<!-- recall-media:end -->

## الفكرة

الرابط المحفوظ وحده لا يوضح أين توقفت. البطاقة تجمع الرابط ونقطة التوقف والخطوة التالية؛ مثل واجب جامعي: «أنهيت السؤالين الأول والثاني، والخطوة القادمة حل السؤال الثالث».

## ما الموجود؟

- بطاقات وروابط وأقسام وقوائم ومواعيد متابعة وعرض أسبوعي.
- بحث وفلاتر حسب الحالة والموعد، وترتيب البطاقات باللمس والفأرة ولوحة المفاتيح.
- مساحة شخصية خاصة ومجموعات مشتركة مع دعوات وتوزيع مهام وصلاحيات للأعضاء.
- حفظ التعديلات على الجهاز دون اتصال، ثم مزامنتها عند فتح التطبيق online.
- اختيار النسخة المحلية أو السحابية عند تعارض تعديلين.
- تسجيل الدخول بالبريد وكلمة المرور أو Google.
- تطبيق ويب قابل للإضافة للشاشة الرئيسية، وإضافة Chromium للكمبيوتر لحفظ عنوان ورابط التبويب الحالي عند الضغط عليها.

هذه نسخة تجريبية. تثبيت الهاتف وقائمة المشاركة الأصلية وGoogle OAuth يحتاجون توثيق فحص على أجهزة فعلية؛ اختبارات المتصفح ليست بديلًا عن ذلك.

## التجربة والتثبيت

افتح [الموقع](https://where-i-left-off.web.app/)، سجّل الدخول وأضف أول بطاقة. سجّل الدخول online أولًا قبل الاعتماد على العمل دون اتصال. المزامنة تعمل عند فتح التطبيق مع الاتصال؛ لا نعد بمزامنة وهو مغلق.

[طريقة التثبيت على Android وiPhone](docs/INSTALL.md) · [إضافة حفظ التبويب للكمبيوتر](browser-extension/README_AR.md)

## التشغيل للمطورين

المتطلبات: Node.js 24 وnpm وJava 21 لاختبارات المحاكيات.

```bash
npm ci --include=dev
cp .env.example .env.local
# ضع إعدادات Firebase web الخاصة بمشروعك داخل .env.local.
npm run dev
```

لتجربة محلية باستخدام المحاكيات، شغّل في نافذتين:

```bash
npm run emulators
npm run dev:emulator
```

## التحقق

```bash
npx playwright install --with-deps chromium
npm run test:tooling
npm audit --audit-level=high
npm run test:all
```

نجحت 44 حالة اختبار: 20 للوظائف، و14 لقواعد Firestore، و10 للمتصفح. ونجحت اختبارات المتصفح في ثلاث جولات متتالية محليًا. فحص التبعيات الكامل أظهر صفر ثغرات معروفة بتاريخ 2026-10-13. نجاحها لا يثبت أن التطبيق آمن بنسبة 100%.

[تفاصيل النتائج وحدودها](TEST_RESULTS.md) · [نطاق الأمان](SECURITY.md) · [خطة التطوير](ROADMAP_AR.md)

لا تشغّل اختبار المتصفح وبناء الإنتاج بالتوازي؛ كلاهما يكتب إلى dist. سكربت النشر الموجود مخصص لمشروع Firebase الخاص بالمطور؛ من ينسخ المشروع يستخدم إعداداته وأهداف الاستضافة الخاصة به.

التطبيق لا يحتوي حاليًا على مساعد AI أو متابعة ردود خارجية أو رفع ملفات فعلية. إلغاء الوصول السحابي لا يمحو نسخًا نُزّلت سابقًا على جهاز غير متصل.

المطور: **[Adam Abu Toamy](https://www.linkedin.com/in/adam-abu-toamy-383250363/)**.


## Free installed-app notifications / إشعارات التطبيق المثبّت

Opt-in Web Push reminders use Cloudflare Workers Free, D1 and Queues. Firebase stays on Spark; no Blaze upgrade or payment card is required for this deployment. Free quotas apply and service may pause when exhausted. Configure the separate Worker before publishing the app. See [setup and phone testing](docs/PUSH_NOTIFICATIONS_AR.md).
