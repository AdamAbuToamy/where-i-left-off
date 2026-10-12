# تشغيل النسخة الجديدة — وين وصلت؟

هذه نسخة معدلة من مشروعك المرفق، مع الحفاظ على التصميم والسحب واللغات الثلاث.

## 1. تثبيت التعديل من Ubuntu

أوقف Vite باستخدام Ctrl+C. ضع ملف ZIP الذي حمّلته في مجلد المنزل في Ubuntu باسم `where-i-left-off-source.zip`. يمكن فتح المنزل في مستكشف Windows بالأمر `explorer.exe .` من Ubuntu ثم وضع الملف هناك.

نفّذ من Ubuntu:

```bash
cd ~
unzip where-i-left-off-source.zip -d where-i-left-off-cloud-update
bash ~/where-i-left-off-cloud-update/install-update.sh ~/projects/where-i-left-off
cd ~/projects/where-i-left-off
```

المثبت يحفظ نسخة احتياطية بجوار مجلد المشروع، ويحدّث الملفات ويثبت الاعتماديات ويفحص البناء والاختبارات المحلية. يحافظ على `.env.local` و`.git`. لا يعدّل حساب Firebase ولا ينشر شيئًا.

## 2. إنشاء الخدمة المجانية

افتح https://console.firebase.google.com/ وسجّل بحسابك:

1. أنشئ مشروعًا على **Spark**. لا تربط وسيلة دفع ولا تُرقِّ إلى Blaze. لا تحتاج Analytics.
2. أضف تطبيق Web من رمز `</>` داخل المشروع. احتفظ بإعدادات `projectId` و`apiKey` و`appId` و`authDomain` الظاهرة لك.
3. من **Authentication → Sign-in method** فعّل **Email/Password** و**Google**، وحدد بريد الدعم عند طلبه.
4. من **Authentication → Settings → Authorized domains** أضف `localhost` إن لم يكن موجودًا. أضف نطاق الموقع عند نشره لاحقًا.
5. من **Firestore Database** أنشئ قاعدة **Standard / Native mode** الافتراضية `(default)`، واختر **Production mode**. اختر المنطقة القريبة المناسبة؛ لا تحتاج Storage أو Functions أو App Hosting.
6. من Ubuntu شغّل معالج الإعداد التالي وأدخل القيم الأربع عندما يسألك. هذه إعدادات Web عامة وليست مفاتيح Service Account:

```bash
node scripts/setup-firebase.mjs
npx firebase login --no-localhost
npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
npm run dev -- --host 0.0.0.0
```

استبدل `YOUR_PROJECT_ID` بمعرّف المشروع الذي أنشأته. أمر النشر ينشر قواعد قاعدة البيانات فقط إلى مشروعك. لا تستخدم Test mode ولا تسمح للجميع بالقراءة والكتابة.

يمكن أيضًا نشر القواعد من تبويب Rules في Firestore، لكن أمر Ubuntu يقلل أخطاء النقل.

## 3. الهاتف والحاسوب

ادخل **بنفس الحساب** في الجهازين. كل مشروع أصبح مستندًا محفوظًا في Firestore، والتغييرات تصل عبر الاشتراك الفوري. انتظر عبارة «متزامن مع حسابك» قبل إغلاق الصفحة.

معاينة Vite على هاتفك تستخدم نفس رابط Windows الذي جهزناه: `http://10.167.22.223:5173` إذا لم يتغير عنوان الشبكة. تسجيل Google قد لا يعمل عبر عنوان IP محلي؛ اختبره على localhost في الحاسوب أو نطاق HTTPS منشور ومضاف للنطاقات المسموحة. لا تعالج هذا بتخفيف قواعد الأمان. تسجيل البريد هو بديل المعاينة المحلية إذا سمحت بيئة المتصفح بذلك.

فتح نفس الموقع لا يزامن بيانات متصفحك وحده؛ المزامنة تحتاج إعداد Firebase أعلاه وتسجيل الحساب نفسه. البيانات التجريبية القديمة في النسخة المرفقة كانت في ذاكرة React فقط، وليست قاعدة قابلة للترحيل. الحساب الجديد يبدأ فارغًا.

## 4. الاختبارات

Node 24 وJava 17 أو 21. اختبارات Firebase تستخدم مشروع `demo-where-i-left-off` محليًا، فلا تكتب إلى حسابك الحقيقي ولا تحتاج بطاقة دفع.

```bash
npm test
npm run lint
npm run build
npm run test:rules
npx playwright install chromium
npm run test:e2e
```

`npm test` يفحص المنطق والترجمات ويَتخطى اختبارات القواعد إن لم يعمل المحاكي. `npm run test:rules` يشغّل المحاكي والقواعد فعليًا. اختبارات المتصفح تبني نسخة اختبار متصلة بمحاكي Authentication وFirestore؛ أعد `npm run build` قبل أي نشر حقيقي.

## 5. ما تغير وكيف تتعلم منه

- `src/CloudApp.tsx`: حالة الحساب والواجهة، شريط المزامنة، البحث والتصفية.
- `src/components/AuthPanel.tsx`: Google والبريد واستعادة كلمة المرور.
- `src/lib/firebase.ts`: الاتصال بالخدمة أو المحاكيات.
- `src/lib/repository.ts`: حفظ/تعديل/حذف/اشتراك في المشاريع.
- `src/lib/projects.ts`: ترتيب البطاقات والتحقق من المدخلات.
- `firestore.rules`: حماية فعلية على الخادم لكل UID، والتحقق من الحقول والأطوال.
- `tests/`: اختبارات المنطق والقواعد والمتصفح.

عند التعديل من جهازين، التعديلات على مشروعين مختلفين مستقلة. إذا تعدل المشروع نفسه أثناء فتح محرره، تُرفض النسخة القديمة وتبقى كتابتك في المحرر. احتفظ بها ثم أغلقه وافتحه لمراجعة أحدث نسخة. تحريك نفس البطاقة بالتزامن يتبع آخر عملية ناجحة؛ لا يحذف محتوى المشاريع. عند تعادل موضعين يستخدم المعرّف لترتيب ثابت على الجهازين.

## 6. حدود النسخة والمجانية

الخدمة مصممة للعمل ضمن حصص Spark المجانية، وليست استخدامًا غير محدود. Firestore يوفر لقاعدة البيانات المجانية 1 GiB و50 ألف قراءة و20 ألف كتابة و20 ألف حذف يوميًا وفق توثيقه وقت إعداد النسخة. إعادة الاتصال وفتح اللوحة على أجهزة عدة تستهلك قراءات. راقب Usage؛ مع عدم ربط فوترة لا نعتمد أي ترقية تلقائية، وقد تتوقف عمليات الخدمة عند نفاد الحصة.

لا تستخدم هذه النسخة الملفات أو الذكاء الاصطناعي أو SMS أو خدمات خلفية مدفوعة. الربط بحساب ChatGPT غير مضاف في هذا التحديث.

عند انقطاع الإنترنت تبقى البيانات المحملة قابلة للقراءة حتى إغلاق الصفحة؛ الكتابة معطلة ما دام المتصفح يبلغ أنه غير متصل. لا توجد مسودات أو قائمة انتظار دائمة بعد إعادة التحميل. إذا انقطع الاتصال أثناء حفظ بدأ فعلًا فقد يبقى «جارٍ الحفظ» حتى يعود الاتصال؛ لا تغلق الصفحة. إعدادات Firebase مطلوبة قبل الاستخدام الحقيقي، ودخول Google الحقيقي يحتاج اختبار نطاقك بعد تفعيله.

المراجع الرسمية:
- https://firebase.google.com/docs/auth/web/google-signin
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/firestore/quotas
- https://firebase.google.com/pricing

## 7. رابط HTTPS مجاني للهاتف وللناس

إعداد Firebase Hosting التقليدي موجود في `firebase.json` (ليس App Hosting). بعد نجاح الإعداد والدخول محليًا، يمكنك نشر الواجهة بنفس مشروع Spark:

```bash
npm run build
npx firebase deploy --only hosting,firestore:rules --project YOUR_PROJECT_ID
```

يعرض الأمر رابطًا من نوع `https://YOUR_PROJECT_ID.web.app`. أضف هذا النطاق إلى Authentication → Authorized domains إذا لم يكن موجودًا. افتح الرابط على الهاتف والحاسوب وسجّل الحساب نفسه. على هذا الرابط لا تحتاج إعدادات WSL أو فتح الحاسوب باستمرار. الحصة المجانية للاستضافة محدودة؛ لا تربط بطاقة ولا تفعّل Blaze. إعداد Firebase مطلوب وقت البناء لأن Vite يضم إعدادات Web في الحزمة. لا تنشر نسخة `VITE_USE_EMULATORS=true`.
