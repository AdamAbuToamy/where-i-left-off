# متابعة العمل والنشر من الهاتف

الكود والتعديلات لا تحتاج تشغيل حاسوبك. workflow «Deploy Worker and website» ينشر Worker ثم واجهة Firebase بعد نجاح Quality checks على main. ويمكن تشغيله يدويًا من تبويب Actions في GitHub على الهاتف. يرفض نشر commit قديم أو فرع آخر. المسار التلقائي لا يعمل على pull requests أو مستودع fork.

## إعداد مرة واحدة بواسطة صاحب الحساب

في إعدادات مستودع GitHub، افتح Secrets and variables → Actions → New repository secret، وضع:

- `CLOUDFLARE_API_TOKEN`: رمز API خاص بالنشر لحساب Cloudflare الخاص بالمشروع. أنشئه في لوحة Cloudflare بصلاحيات نشر Worker والموارد المرتبطة به، وحدد حساب المشروع. لا تضعه في المحادثة.
- `CLOUDFLARE_WORKER_CONFIG`: محتوى ملف `push-worker/wrangler.local.json` الموجود عندك بعد الإعداد الناجح، بما فيه account_id وD1 وvars والطوابير. لا تستخدم wrangler.jsonc ذي القيم SET_BY_SETUP_SCRIPT. لا تضف مفاتيح النموذج أو حساب خدمة Firebase إلى هذا الملف.
- `FIREBASE_SERVICE_ACCOUNT`: اعتماد نشر Firebase Hosting الموجود في إعداد workflow القديم. إن كان مضافًا بالفعل فلا تعِد إضافته.

مفاتيح Groq/Gemini وFirebase Reader وVAPID الخاصة تبقى مخزنة كأسرار في Cloudflare؛ workflow لا يحتاج نسخها إلى GitHub. حساب Wrangler المسجل محليًا في أوبونتو لا ينتقل تلقائيًا إلى GitHub.

إذا كنت تستخدم gh CLI ومصادقًا لحسابك، يمكن رفع إعداد Worker المحلي دون عرضه في الطرفية:

```bash
gh secret set CLOUDFLARE_WORKER_CONFIG --repo AdamAbuToamy/where-i-left-off < push-worker/wrangler.local.json
gh secret set CLOUDFLARE_API_TOKEN --repo AdamAbuToamy/where-i-left-off
```

الأمر الثاني يطلب الرمز؛ لا تكتبه في المحادثة أو ملف داخل المستودع. يمكن أيضًا إدخاله في صفحة GitHub الآمنة من الهاتف. بعد إضافة الأسرار شغّل workflow يدويًا مرة، ثم تابع نتيجة النشر من Actions. وجود ملف workflow وحده لا يثبت أن الأسرار أضيفت أو أن النشر نجح.

النشر هنا يحدّث Worker وHosting فقط، ويحافظ على أسرار Cloudflare الحالية؛ لا يرفع أسرارًا جديدة، ولا يجري ترحيل D1، ولا يغير قواعد Firestore أو الفوترة. عند تغيير provider أو ربط قاعدة أو إعداد تطبيق، حدّث سر الإعداد من الملف الصحيح. تغييرات القواعد أو ترحيل البيانات تحتاج خطوة نشرها الخاصة.

توثيق Cloudflare الرسمي: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
