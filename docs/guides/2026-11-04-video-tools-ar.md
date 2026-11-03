# أدوات الفيديوهات: التثبيت والاستخدام في Codex

تم التحقق من مصادر المشاريع بتاريخ 2026-11-04. هذه حزم تعليمات وأدوات مراجعة؛ لا تغيّر النموذج إلى «سينيور» ولا تضمن صحة النتائج. ابدأ بحزمة واحدة واختر المهارة المناسبة للمهمة.

## الحزم الست التي ظهرت

| الحزمة | المصدر الأصلي | فائدتها |
| --- | --- | --- |
| Karpathy Skills | [forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills) | تحديد الافتراضات وتقليل التغييرات غير المطلوبة |
| Ponytail | [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) | حلول بسيطة مع الحفاظ على التحقق والأمان |
| Matt Pocock Skills | [mattpocock/skills](https://github.com/mattpocock/skills) | مهارات صغيرة للتخطيط والهندسة والمراجعة |
| Agent Skills | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | سير عمل ومراجعة جودة واختبارات |
| ECC | [affaan-m/ECC](https://github.com/affaan-m/ECC) | حزمة كبيرة من المهارات والتكاملات؛ تحتاج اختيارًا مدروسًا |
| Superpowers | [obra/superpowers](https://github.com/obra/superpowers) | تخطيط وتنفيذ ومراجعة منظمة |

## أسهل طريق داخل تطبيق Codex

لـ Superpowers: افتح Plugins، وابحث عن Superpowers ثم اضغط إضافة، إذا ظهر في دليل الإضافات المتاح لديك. هذه طريقة التثبيت التي يذكرها المشروع لتطبيق Codex.

للمهارات الأخرى يمكنك كتابة الطلب التالي داخل Codex، مع تبديل رابط المستودع بالحزمة المطلوبة:

```text
$skill-installer افحص المهارات الموجودة في https://github.com/DietrichGebert/ponytail
اعرض لي المهارات المناسبة أولًا، ثم ثبّت المهارة التي أختارها.
حافظ على AGENTS.md وإعداداتي الحالية، ولا تثبّت نسختين من المهارة نفسها.
```

هذه الطريقة مناسبة لتطبيقك على Windows. تثبيت أداة في Ubuntu وحده لا يعني أنها ستظهر في تطبيق Windows؛ لكل بيئة مجلد مستخدم وإعدادات خاصة.

## طريق الطرفية للمهارات القابلة للاختيار

تحتاج Node.js حديثًا؛ Node 24 الموجود في Ubuntu مناسب. هذه أوامر أداة [Vercel Skills](https://github.com/vercel-labs/skills)، وليست أوامر Claude Code. من Ubuntu:

```bash
source ~/.nvm/nvm.sh
node --version
cd /home/adam/wilo-test
npx skills@latest add DietrichGebert/ponytail --list
npx skills@latest add DietrichGebert/ponytail -a codex
```

الأمر الأول يعرض المهارات، والثاني يفتح اختيار المهارات للتثبيت في المشروع. لا تضف `-y` أو تثبيت الجميع قبل المراجعة. للتثبيت الشخصي عبر المشاريع أضف `-g` للأمر الثاني. لتثبيت مهارات لتطبيق Windows استخدم الطرفية وNode في Windows، أو مثبّت المهارات داخل التطبيق أعلاه.

يمكن استبدال اسم المصدر بأحد هذه المصادر، كل مرة على حدة:

```text
forrestchang/andrej-karpathy-skills
DietrichGebert/ponytail
mattpocock/skills
addyosmani/agent-skills
affaan-m/ECC
obra/superpowers
```

تثبيت مهارات فقط لا يثبت تلقائيًا جميع وظائف الإضافات مثل hooks أو MCP. للحزم التي تعتمد عليها استخدم طريقة الإضافة الأصلية. لا تثبّت نسخة Skills ونسخة Plugin من الحزمة نفسها معًا.

للمراجعة والتحديث:

```bash
npx skills@latest list
npx skills@latest check
npx skills@latest update
```

وفق [توثيق Codex الرسمي](https://learn.chatgpt.com/docs/build-skills)، يكتشف Codex مهارات المشروع في `.agents/skills`، والمهارات الشخصية في `~/.agents/skills`؛ مثبّت Codex المدمج قد يستخدم مساره المخصص الذي يذكره عند التثبيت. إذا لم تظهر مهارة جديدة، أعد فتح المحادثة أو التطبيق. لا تستبدل AGENTS.md بملف من مستودع خارجي.

## إضافات Codex الأصلية للحزم الكبيرة

هذه الأوامر من مستودعات الحزم الحالية. تحقق أولًا من أن نسخة Codex CLI عندك تعرض `plugin` في `codex --help`. إذا لم تعرضه، استخدم واجهة Plugins أو مثبّت المهارات بدل تجربة أوامر غير مدعومة.

```bash
# Matt Pocock
codex plugin marketplace add mattpocock/skills
codex plugin add mattpocock-skills@mattpocock

# Addy Osmani
codex plugin marketplace add addyosmani/agent-skills
codex plugin add agent-skills@agent-skills

# ECC
codex plugin marketplace add affaan-m/ECC
codex plugin add ecc@ecc
```

راجع طلبات الثقة للتكاملات التي تختارها. لا تنسخ إعدادات approvals أو sandbox أو ملفات AGENTS الخاصة بحزمة فوق إعدادات WILO. لم أُثبّت هذه الحزم الست تلقائيًا على جهازك ضمن هذا العمل.

## Desloppify: الأداة التي استخدمتها فعليًا لتنظيف WILO

[المصدر الأصلي](https://github.com/peteromallet/desloppify). ثبّتّها داخل بيئة Python معزولة بالمشروع، دون إضافتها إلى حزمة الموقع:

```bash
cd /home/adam/wilo-test
.wrangler/desloppify-venv/bin/desloppify --lang typescript scan --path src --profile ci --no-badge
.wrangler/desloppify-venv/bin/desloppify show security --no-budget
.wrangler/desloppify-venv/bin/desloppify status
```

لأي مشروع جديد: أنشئ بيئة `python3 -m venv .venv-quality` ثم ثبّت `desloppify` داخلها. Python 3.11 أو أحدث مطلوب. راجع كل نتيجة قبل تعديل الكود؛ الأداة قد تعتبر مفاتيح Firebase العامة أو النصوص المترجمة أسرارًا بالخطأ. نتيجة الفحص الآلي لا تعني اجتياز مراجعة بشرية أو أمنية شاملة.

## التصميم وGoogle

مكتبة التصميم في الفيديو هي [The Kitchen — dqnamo](https://www.dqnamo.com/kitchen). اعتمدت دراستي Ticket وTactile Button كمراجع للتفاعل، مع CSS أصلي ملائم لـ WILO؛ لم أنقل كود مكونات بلا ترخيص واضح ولم أضف مشغّل كاسيت أو دفع غير مطلوب.

فيديو Search Console يشرح التحقق وإرسال الخريطة. هذه الخطوات موجودة بالفعل في WILO؛ لا تعيد إنشاء الملكية ولا تضف حسابات أو مفاتيح بحث جديدة لحل quota. راجع تقرير التسليم لتفاصيل ما تم فحصه وما يبقى بيد Google.
