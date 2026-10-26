import {readFileSync,writeFileSync,mkdirSync,statSync} from 'node:fs';
import {sourceFingerprint} from './lib/localReleaseGate.mjs';
const clean=text=>text.replace(/\x1b\[[0-9;]*m/g,'');
const log=path=>clean(readFileSync(path,'utf8'));
const count=(path,pattern)=>{const text=log(path),match=text.match(pattern);if(!match)throw new Error('Missing successful evidence: '+path);return Number(match[1]);};
const tests={
 unit:count('/tmp/wilo-readiness-unit-final.log',/\bTests\s+(\d+)\s+passed/),
 security:count('/tmp/wilo-readiness-security-final.log',/\bTests\s+(\d+)\s+passed/),
 worker:count('/tmp/wilo-readiness-worker-final.log',/ℹ pass (\d+)/),
 browser:count('/tmp/wilo-readiness-browser-final.log',/^\s*(\d+)\s+passed \(/m),
 auth:count('/tmp/wilo-readiness-auth.log',/\bTests\s+(\d+)\s+passed/),
};
if(tests.unit<1123||tests.security!==675||tests.worker!==867||tests.browser!==37||tests.auth!==3)throw new Error('Readiness coverage incomplete');
const lint=log('/tmp/wilo-readiness-lint-final.log'),types=log('/tmp/wilo-readiness-types.log');
if(/\b[1-9]\d* errors?\b/.test(lint)||types.trim())throw new Error('Lint or type failures remain');
const parse=name=>JSON.parse(readFileSync(name,'utf8'));
const audit=parse('/tmp/wilo-readiness-audit.json'),tooling=parse('/tmp/wilo-readiness-audit-all.json'),live=parse('assistant-stream-live-verification.json'),firstLive=parse('assistant-stream-live-first-measurement.json'),production=parse('production-readonly-check.json'),auth=parse('auth-browser-report.json');
const architecture=JSON.parse(log('/tmp/wilo-readiness-architecture.log').slice(log('/tmp/wilo-readiness-architecture.log').indexOf('{')));
if(architecture.status!=='passed'||audit.metadata.vulnerabilities.total||live.status!=='passed'||production.status!=='passed'||auth.status!=='public-auth-checks-passed')throw new Error('Required readiness evidence failed');
const yes=(label,evidence)=>({label,status:'passed',evidence}),manual=(label,evidence)=>({label,status:'manual',evidence}),limit=(label,evidence)=>({label,status:'limitation',evidence});
const groups=[
 {name:'الحساب والخصوصية',checks:[
  yes('تسجيل الدخول والخروج والتحقق من البريد واستعادة كلمة المرور','3 اختبارات Auth بالمحاكي، واختبارات المتصفح للحسابات.'),
  yes('تطابق مشروع Firebase ونطاقات Auth في الموقع المنشور','فحص عام للقراءة فقط؛ النطاقان أعادا 200 دون نطاق مفقود.'),
  yes('عزل البيانات الشخصية والمجموعات ومنع انتحال الإدارة','675 اختبار قواعد وحفظ، ومنها محاولات مرفوضة مقصودة.'),
  yes('منع ظهور تعديلات حساب سابق بعد تبديل الحساب أو الخروج','اختبارات الحسابات والطابور المحلي والعمل دون اتصال.'),
  yes('حماية النصوص والروابط غير الموثوقة وعدم كشف الأسرار في التشخيص','اختبارات العرض والأذونات وفحص أنماط الاعتمادات.'),
  manual('دخول Google الحقيقي ثم ربط Pollinations بعد الخروج والعودة','المحاكيات لا تثبت موافقة Google/OAuth الحقيقية على جهاز المستخدم.'),
  manual('اكتمال حذف حساب تجريبي وبياناته في بيئة نشر مخصصة','اختبارات القواعد موجودة؛ لم ننفذ حذف حساب إنتاجي.'),
 ]},
 {name:'البطاقات والأقسام والمجموعات',checks:[
  yes('إضافة وتعديل وحذف واستعادة وأرشفة البطاقات والأقسام','اختبارات المتصفح والحفظ وقواعد Firestore.'),
  yes('الملاحظات والقوائم والتقدم ونقطة التوقف والخطوة التالية','اختبارات الكيانات والحقول والحفظ وإعادة التحميل.'),
  yes('المواعيد وعرض الأسبوع والفرز والبحث واللغات الثلاث','اختبارات التنقل والتخطيط والنصوص الطويلة والهواتف.'),
  yes('دعوات المجموعات والأدوار والإسناد والمزامنة بين جلستين','سيناريو مجموعات فعلي داخل محاكيات Firebase.'),
  yes('حفظ التغييرات دون اتصال وبقاؤها بعد إعادة التحميل','اختبارات CRUD والطابور والمزامنة بعد عودة الاتصال.'),
  yes('تعارض جهازين لا يطمس التعديل الأحدث بصمت','سيناريوهات التعارض والاختيار الصريح والتحقق من المراجعة.'),
 ]},
 {name:'الجامعة',checks:[
  yes('الكورسات والمتطلبات ومنع الحلقات والمهام والمواعيد','اختبارات حالة الجامعة والاستيراد والقواعد.'),
  yes('الجدول الأسبوعي والمحاضرات والتمارين والمختبرات','استيراد 14 حصة عبر واجهة المساعد ثم الحفظ وإعادة التحميل.'),
  yes('مطابقة الأسماء المرقمة ومنع تكرار الحصص المحفوظة','سيناريوهان للبرنامج الأسبوعي مع تأكيد العدد بعد إعادة الطلب.'),
  yes('الاستيراد والتحقق من النسخ الاحتياطية قبل الحفظ','اختبارات المحلل وحالة الجامعة والتصدير.'),
  yes('عرض الهاتف وخريطة الكورسات والتوقيت والأيام','اختبار الجامعة في المتصفح واختبارات التواريخ والمناطق الزمنية.'),
  manual('استعادة نسخة حقيقية ممثلة لحساب قديم في بيئة اختبار','لم تُنسخ بيانات المستخدمين الإنتاجية أو تُغيّر أثناء الفحص.'),
 ]},
 {name:'المساعد',checks:[
  yes('التحية تبقى محادثة ولا تقرأ الحساب أو تحفظ شيئًا','اختبارات التوجيه وتجربة حية للتحية.'),
  yes('الأوامر دوال جاهزة ومخرجات المودل تُفحص قبل Apply','اختبارات العقود والحقول والتغطية والحفظ من زر التطبيق.'),
  yes('طلب مركّب مع ترابط الأقسام والبطاقات والمواعيد والتصحيح الأخير','تجربة حية بثلاث حالات واختبارات محاكية للحفظ.'),
  yes('عدم إسقاط PDF أو جزء من الطلب المركب بصمت','تحقق اكتمال المقترح وتصحيح محدود عند النقص.'),
  yes('قراءة بيانات الكورسات الكبيرة على دفعات','اختبارات السياق والصفحات؛ إثبات حي سابق على بيانات 1.5 مليون حرف.'),
  yes('الرد المتدرج لا ينفذ أوامر جزئية أو ردًا مقطوعًا','اختبارات UTF-8 واستدعاءات متداخلة ونهاية مفقودة وإلغاء الطلب.'),
  yes('المهلة والإلغاء وإعادة المحاولة محدودة ولا تعيد الحفظ','25 ثانية من الصمت وحد أقصى 60 ثانية، ولا إعادة توليد تلقائية بعد وصول خرج جزئي.'),
  yes('زر فحص الاتصال يقرأ الحساب ويفحص المودل فعلًا','أزيل إعلان الجاهزية الوهمي؛ لا يظهر النجاح قبل نجاح الفحصين.'),
  yes('تشخيص زمني بلا رسائل المستخدم أو المفاتيح أو محتوى الحساب','التشخيص يسجل المراحل والمدد والحجم والحالة فقط.'),
  yes('إصلاح المقترح لا ينتظر مهلة الخادم القديم ولا يرفض لقطة محلية كبيرة','أزيل تأخير 3.2 ثانية لمسار المفتاح الشخصي، واختبار إصلاح لقطة 200 ألف حرف.'),
  limit('سرعة المزوّد وحصته المجانية ليستا تحت سيطرة الموقع','تجارب حية محدودة موثقة؛ الطلبات المكررة قد تستفيد من كاش المزوّد.'),
  limit('هذه الجولة ليست إعادة تشغيل 618 برومبتًا حيًا على المودل','اختبارات المنطق والقواعد تشمل مجموعات كبيرة بحقن ردود؛ الجولة الحية الجديدة ثلاث حالات.'),
  limit('البحث في الويب وإيجاد أول فيديو غير متاحين للمساعد','السلوك الصحيح طلب الرابط المباشر، وليس اختراع رابط أو الادعاء بالتصفح.'),
 ]},
 {name:'التصدير والتصميم وإمكانية الوصول',checks:[
  yes('PDF فعلي قابل للفتح مع العربية وتقسيم الصفحات','اختبارات PDF وفحص بصري سابق لملف عربي متعدد الصفحات.'),
  yes('امتدادات TXT/Markdown/CSV/JSON/PDF محفوظة وأسماء الملفات آمنة','اختبارات محلل الرد وبطاقات التنزيل.'),
  yes('الهاتف والكمبيوتر وRTL/LTR وعدم تجاوز العرض','37 سيناريو متصفح، بينها العربية والعبرية والإنجليزية.'),
  yes('التنقل بلوحة المفاتيح وإغلاق المساعد وإرجاع التركيز','اختبارات القوائم والمساعد والاستجابات المتأخرة.'),
  yes('الحركة تحترم prefers-reduced-motion ولا تعطل الاستخدام','فحص متصفح لحالة تقليل الحركة.'),
  yes('فحص axe الآلي لصفحة العمل والمساعد على الهاتف والكمبيوتر','لم تظهر مخالفات في قواعد WCAG 2/2.1 A وAA ضمن الشاشات المفحوصة.'),
  limit('PDF الحالي صفحات مرسومة وليس نصًا قابلًا للبحث أو النسخ','هذا حد معروف، ولا يُعد التصدير فشلًا صامتًا.'),
  manual('تجربة قارئ شاشة حقيقي وSafari وFirefox على الأجهزة المستهدفة','فحص Chromium ومحاكاة الهاتف لا يثبت هذه البيئات.'),
 ]},
 {name:'الإضافة والتنبيهات والتشغيل',checks:[
  yes('التقاط الرابط والتوقيت وحفظ نسخة واحدة بعد التكرار','اختبارات الالتقاط والإضافة التلقائية وإعادة التحميل.'),
  yes('تفضيلات التنبيهات والاشتراك الصريح وإلغاء الاشتراك','اختبارات المتصفح وعقود Worker.'),
  yes('HTTPS ورؤوس CSP وHSTS وnosniff وحماية الإطارات','فحص للموقع المنشور، دون كتابة إنتاجية.'),
  yes('الفحص البرمجي وقواعد البيانات والخادم والأنواع والبناء','النتائج العددية أدناه، مع سجل فحص الاعتمادات.'),
  yes('تبعيات الإنتاج بلا ثغرات معلنة في نتيجة npm audit الحالية','نتيجة audit --omit=dev: صفر.'),
  yes('فصل النواة عن التخزين والمتصفح وحقن القفل والاتصال','فحص AST لأربع نقاط دخول و14 وحدة مترابطة.'),
  yes('اعتماد الإرشادات في الجذر وربطها بتعليمات المستودع','PROJECT_ENGINEERING_GUIDELINES.md وAGENTS.md وقرار معماري.'),
  yes('إعدادات نشر متوافقة مع مفاتيح كل مستخدم دون Gemini المشترك','تحديثات ملفات CI مفحوصة محليًا؛ لا تغيير لخادم push المنشور.'),
  limit('بقيت خمس ملاحظات متوسطة في أدوات التطوير التابعة لـFirebase CLI','أزيلت الملاحظات العالية بإصلاحات متوافقة. التراجع القسري لإصدار رئيسي أقدم لم يُنفذ.'),
  manual('تثبيت الإضافة من متجر Chrome واختبار الصلاحيات في ملف مستخدم حقيقي','اختبارات الموقع والالتقاط لا تقوم مقام تثبيت المتجر.'),
  manual('تثبيت PWA والمشاركة وتنبيه يصل فعليًا لهاتف Android/iOS','اختبارات التفضيلات والعقود لا تثبت تسليم إشعار لجهاز فعلي.'),
  manual('فحص App Check والكتابة من حساب إنتاجي عادي على النسخة النهائية','فُحصت القواعد بالمحاكيات والتهيئة العامة؛ لم تُستخدم جلسة حساب إنتاجي.'),
  manual('تجربة استعادة تشغيلية وخطة مراقبة استخدام المزوّد والحصص','لم تُنفذ اختبارات حمل طويل أو استعادة بيانات إنتاجية أو إرسال إشعار لمستخدمين.'),
  manual('تشغيل إعدادات GitHub الجديدة بعد رفعها','الملفات اختُبرت محليًا؛ لم ننشئ commit أو نشغل workflow بعيدًا في هذه الجولة.'),
 ]},
];
const evidencePaths=['/tmp/wilo-readiness-unit-final.log','/tmp/wilo-readiness-security-final.log','/tmp/wilo-readiness-worker-final.log','/tmp/wilo-readiness-browser-final.log','/tmp/wilo-readiness-auth.log'];
const report={status:'automated-passed-manual-checks-pending',generatedAt:new Date().toISOString(),timezone:'Asia/Jerusalem',fingerprint:sourceFingerprint(),tests,automatedTotal:Object.values(tests).reduce((sum,n)=>sum+n,0),architecture,dependencyAudit:{production:audit.metadata.vulnerabilities,all:tooling.metadata.vulnerabilities},liveProvider:{latest:live,firstMeasurement:firstLive},productionReadOnly:production,publicAuth:auth,ciRemoteRun:false,productionWrites:0,groups,evidence:evidencePaths.map(path=>({path,modifiedAt:statSync(path).mtime.toISOString()}))};
mkdirSync('docs/readiness',{recursive:true});writeFileSync('docs/readiness/2026-10-26.json',JSON.stringify(report,null,2));
let md='# قائمة جاهزية الموقع — 26 أكتوبر 2026\n\nالحالة: **نجحت الفحوص الآلية؛ الجاهزية الشاملة مشروطة بالفحوص اليدوية أدناه**. فحوص الحسابات والحفظ استخدمت بيانات محلية مؤقتة في محاكيات Firebase، وليس حسابات الإنتاج. لا توجد كتابة إنتاجية في الاختبارات.\n\n';
md+='## النتائج\n\n| الفحص | الحالات الناجحة |\n| --- | ---: |\n'+Object.entries(tests).map(([name,n])=>'| '+name+' | '+n+' |').join('\n')+'\n\nالمجموع الآلي: **'+report.automatedTotal+'**. أضيفت ثلاث حالات حية للمزوّد، وليست هذه إعادة للـ618 حالة الحية. فحص الإنتاج للقراءة فقط لا يثبت دخول Google أو الكتابة من حساب مستخدم فعلي.\n\n';
md+='اختبار المزوّد الأول: '+firstLive.results.map(r=>r.id+': '+(r.totalMs/1000).toFixed(1)+' ث').join('، ')+'. إعادة الطلبات كانت أسرع وقد تتأثر بكاش المزوّد؛ لا يُقدّم ذلك ضمانًا لزمن ثابت.\n\n';
for(const group of groups){md+='## '+group.name+'\n\n';for(const check of group.checks)md+='- ['+(check.status==='passed'?'x':' ')+'] **'+(check.status==='manual'?'فحص يدوي مطلوب: ':check.status==='limitation'?'حد معروف: ':'')+check.label+'** — '+check.evidence+'\n';md+='\n';}
md+='## التشغيل وإعادة الفحص\n\nالأوامر: npm test، npm run test:rules، npm run test:auth:recovery، node --test push-worker/*.test.mjs، npm run test:e2e، npm run lint، npx tsc -b، npm run check:architecture، npm audit --omit=dev، npm run build. يلزم Java 21 للمحاكي. استُخدم منفذ معاينة معزول 5193 لأن 5173 كان مشغولًا.\n\nقبل إصدار جديد: أعد الفحوص المتأثرة، وتحقق من إعدادات الإنتاج وApp Check، ثم انشر Hosting وتحقق من wilo-release.json. قرار الفصل والتدفق وخطة الرجوع في ../adr/2026-10-26-streaming-and-core-boundaries.md. لا توجد هجرة مخطط بيانات في هذا الإصدار.\n';
writeFileSync('docs/READINESS_AR.md',md);console.log(JSON.stringify({status:report.status,tests:report.tests,total:report.automatedTotal,checks:groups.reduce((n,g)=>n+g.checks.length,0),fingerprint:report.fingerprint}));
