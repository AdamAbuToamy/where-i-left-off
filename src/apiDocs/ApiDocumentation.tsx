import { useState } from "react";
import type { Language } from "../translations";
import {
  apiBase,
  contract,
  operations,
  requestCode,
  workflowCode,
  operationBody,
  resolveSchema,
  errorResponseCode,
} from "./contract";
import type { CodeLanguage, ApiOperation } from "./contract";
import "./apiDocs.css";
const words = {
  ar: {
    back: "إعدادات API Keys",
    intro: "اربط تطبيقاتك ببيانات حسابك، بالصلاحيات التي تختارها.",
    quick: "بداية سريعة",
    auth: "المصادقة",
    workflow: "مثال متكامل",
    reference: "مرجع العمليات",
    errors: "الأخطاء وإعادة المحاولة",
    security: "حماية المفتاح",
    download: "تحميل OpenAPI",
    search: "ابحث عن مسار أو صلاحية أو عملية",
    copy: "نسخ",
    copied: "تم النسخ",
    copyFailed: "تعذر النسخ. حدد النص وانسخه يدويًا.",
    language: "لغة المثال",
    noResults: "لا توجد عمليات تطابق البحث.",
    scope: "الصلاحيات المطلوبة",
    body: "حقول الطلب",
    field: "الحقل",
    type: "النوع",
    required: "مطلوب",
    optional: "اختياري",
    responses: "الاستجابات",
    parameters: "معاملات الطلب",
    version: "الإصدار",
    steps: [
      "أنشئ مفتاحًا من إعدادات الحساب. اختر أقل صلاحيات تحتاجها؛ لهذا المثال اختر courses:read. احفظ المفتاح عند عرضه، لأنه يظهر مرة واحدة فقط.",
      "احتفظ بالمفتاح محليًا في متغير البيئة WILO_API_KEY أو مخزن أسرار. الأمثلة تستخدم REPLACE_WITH_YOUR_API_KEY كبديل فقط. يمكنك استبداله محليًا في نسخة خاصة خارج المستودع؛ الأفضل متغير البيئة أو مخزن الأسرار. لا تلصق مفتاحك في هذه الصفحة.",
      "انسخ المثال وشغّله محليًا. استجابة 200 تعرض result.items. القائمة الفارغة نتيجة ناجحة إذا لم تضف مقررات بعد.",
    ],
    authText:
      "استخدم HTTPS وأرسل المفتاح في Authorization: Bearer <key>. المفتاح يحدد حساب صاحبه فقط؛ لا ترسل معرّف مستخدم آخر. صلاحية الكتابة لا تمنح القراءة تلقائيًا. لا تحتاج جلسة Google أو Firebase App Check لكل طلب خارجي.",
    agent:
      "لا يعلن عقد Wilo أو مسار المصادقة شرطًا لقيمة خاصة في User-Agent. لا ننسب خطأ 403 سابقًا إليه دون دليل. إذا كانت الاستجابة JSON من Wilo، افحص error وrequestId والصلاحيات. إذا كانت صفحة HTML لحماية الشبكة، احتفظ بمعرّف الطلب وتواصل مع الدعم؛ لا تغيّر هوية العميل للتحايل على الحماية.",
    runtime:
      "أمثلة JavaScript مخصصة لـNode.js 18+ أو خادم موثوق. لا تضع المفتاح في واجهة ويب أو تطبيق موزّع. ثبّت requests في بيئة Python. الأمثلة نصوص فقط؛ هذه الصفحة لا تنفّذ طلبات بيانات.",
    flowText:
      "اختر courses:read وtasks:write. اقرأ المقررات، ثم اختر معرّف المقرر المقصود من result.items وضعه في courseId. المثال يرفض المتابعة دون اختيار واضح؛ لا يختار أول مقرر تلقائيًا. إذا كانت هناك صفحة تالية، تابع عبر nextCursor.",
    pagination:
      "قراءة القوائم: limit من 1 إلى 100 وcursor من nextCursor. لإضافة مورد استخدم POST مع values. للتحديث انسخ id وrevision من قراءة حديثة، ثم ضع revision في expectedRevision وأرسل PATCH. بعض أنواع الموارد لها عمليات مختلفة؛ اتبع المرجع أدناه.",
    retry:
      "للعمليات التي تعلن Idempotency-Key، استخدم معرّفًا جديدًا لكل عملية مقصودة واحفظه. عند انقطاع الاتصال أعد نفس الطلب بنفس المعرف، ولا تنشئ معرفًا جديدًا للمحاولة نفسها. تغيّر المحتوى مع المعرف نفسه يعيد 409. أسماء المعرفات في الأمثلة توضيحية؛ غيّرها للعمليات الجديدة.",
    conflict:
      "عند 409 اقرأ أحدث نسخة وراجع التعديلات قبل إعادة الإرسال. لا تستبدل تعديلاتك أو تعديلات المستخدم تلقائيًا. استبدال اللوح عبر PUT يستبدل حالته كاملة؛ اقرأ اللوح أولًا وحافظ على العناصر التي تريد إبقاءها. لربط واجب موجود استخدم POST /tasks/{id}/reminder ثم تحقق عبر GET للمسار نفسه؛ 202 تعني انتظار الإكمال، ولا تعتبر العملية مجدولة إلا إذا كانت scheduled=true. تعديل محتوى السجلات المرتبطة يبقى عبر واجهة Wilo. تحديث إعدادات تذكير البطاقة عملية PUT مطلقة ولا يفعّل الإشعارات العامة.",
    keySafety:
      "أي شخص يمتلك المفتاح قد يصل إلى بيانات حسابك ضمن الصلاحيات الممنوحة. لا تشاركه ولا تضعه في Git أو URL أو سجلات الطلبات. خزّنه في مخزن أسرار على خادمك، واستخدم مفتاحًا منفصلًا لكل تطبيق.",
    rotation:
      "من إعدادات API Keys يمكنك إلغاء المفتاح أو استبداله. الاستبدال يحذف سجل المفتاح القديم ويعرض البديل مرة واحدة، ويحافظ على صلاحياته وانتهائه. حدّث سر التطبيق بالمفتاح البديل. عند فقد المفتاح أو انكشافه ألغِه وأنشئ آخر. الطلبات الجارية قد تنتهي بعد الإلغاء.",
    errorsText:
      "افحص HTTP status أولًا. ردود Wilo تتضمن error وrequestId. احتفظ بمعرف الطلب للتشخيص، دون المفتاح أو محتوى حسابك. احترم Retry-After عند 429 أو 503، ولا تعاود إرسال طلبات كتابة بمعرف جديد.",
    errorHelp: {
      "401":
        "المفتاح مفقود أو غير صحيح أو منتهي أو ملغى. تحقق من Authorization دون طباعة المفتاح.",
      "403":
        "الصلاحية المطلوبة غير ممنوحة، أو الحساب غير متاح. راجع Scopes وحالة الحساب.",
      "429":
        "تجاوزت حد الاستخدام المشترك للحساب. انتظر المدة المحددة في Retry-After ثم حاول.",
    },
  },
  en: {
    back: "API Key settings",
    intro:
      "Use your account data in your applications, with permissions you control.",
    quick: "Quick Start",
    auth: "Authentication",
    workflow: "Complete workflow",
    reference: "API reference",
    errors: "Errors and retries",
    security: "Key security",
    download: "Download OpenAPI",
    search: "Search paths, scopes or operations",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Copy failed. Select and copy the text manually.",
    language: "Example language",
    noResults: "No matching operations.",
    scope: "Required scopes",
    body: "Request fields",
    field: "Field",
    type: "Type",
    required: "Required",
    optional: "Optional",
    responses: "Responses",
    parameters: "Parameters",
    version: "Version",
    steps: [
      "Create a key in Account Settings. Choose only needed scopes; use courses:read for this first request. Save the secret when shown: it appears only once.",
      "Keep the key locally in WILO_API_KEY or a secret manager. Examples use REPLACE_WITH_YOUR_API_KEY only. Replace it locally in a private copy outside your repository, or preferably use the environment/secret manager. Never paste your key into this documentation.",
      "Copy and run the example locally. HTTP 200 returns result.items. An empty array is successful when no courses have been added.",
    ],
    authText:
      "Use HTTPS and Authorization: Bearer <key>. The key selects only its owner’s account; do not send another user ID. Write permission does not automatically include read permission. External requests do not require a Google session or Firebase App Check.",
    agent:
      "Neither the Wilo contract nor its authentication handler declares a special User-Agent value. A previous 403 cannot be attributed to that header without evidence. For Wilo JSON errors, check error, requestId and scopes. For an HTML network-protection page, keep the request identifier and contact support; do not impersonate a different client to evade protection.",
    runtime:
      "JavaScript examples target Node.js 18+ or a trusted server. Never embed a key in a browser bundle or distributed app. Install requests in your Python environment. Examples are text only: this page sends no account-data requests.",
    flowText:
      "Choose courses:read and tasks:write. Read courses, select the intended course ID from result.items, then use it as courseId. The example requires an explicit choice instead of choosing the first course. Follow nextCursor if you need another page.",
    pagination:
      "Lists accept limit 1–100 and cursor from nextCursor. Create with POST and values. To update, read a recent id/revision, pass that revision as expectedRevision, and PATCH the resource. Some resource types use other operations: follow the reference.",
    retry:
      "Where Idempotency-Key is declared, generate and save a unique identifier for each intended operation. Retry the exact request with the same identifier after a connection failure. Do not generate a new key for the same retry. Reusing a key with different content returns409. Example identifiers are illustrative; change them for new operations.",
    conflict:
      "On409, reread the latest revision and review changes before resubmitting. Never blindly overwrite manual changes. Board PUT replaces the whole state: read it first and preserve items you want to keep. Link existing assignments with POST /tasks/{id}/reminder, then GET the same path to verify.202 is pending, and only scheduled=true confirms native schedule registration. Editing linked record contents still requires the Wilo UI. Reminder settings PUT is an absolute replacement and never enables global notification delivery.",
    keySafety:
      "Anyone holding a key can access its owner’s data within granted scopes. Never share it or put it in Git, URLs or request logs. Use a server-side secret manager and a separate key for each application.",
    rotation:
      "Revoke or replace keys in API Key settings. Replacement immediately deletes the old credential record, shows the new secret once, and preserves scopes and expiry. Update your application’s secret. Revoke exposed/lost keys and issue replacements. Requests already in flight can finish after revocation.",
    errorsText:
      "Check HTTP status first. Wilo error responses include error and requestId. Keep the request ID for diagnostics without recording credentials or account content. Honor Retry-After on429/503. Do not retry a write with a new operation ID.",
    errorHelp: {
      "401":
        "Missing, invalid, expired or revoked key. Check Authorization without printing the credential.",
      "403":
        "Required scope missing, or account unavailable. Check granted scopes and account status.",
      "429":
        "Account-wide request limit reached. Wait for Retry-After before retrying.",
    },
  },
};
function Code({ code, language }: { code: string; language: Language }) {
  const t = words[language === "ar" ? "ar" : "en"],
    [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <div className="api-doc-code">
      <div className="api-doc-code-toolbar">
        <span dir="ltr">Example</span>
        <button
          type="button"
          onClick={() => {
            try {
              void navigator.clipboard
                .writeText(code)
                .then(() => setState("copied"))
                .catch(() => setState("failed"));
            } catch {
              setState("failed");
            }
          }}
        >
          {state === "copied" ? t.copied : t.copy}
        </button>
      </div>
      <pre dir="ltr">
        <code>{code}</code>
      </pre>
      <span role="status">
        {state === "failed" ? t.copyFailed : state === "copied" ? t.copied : ""}
      </span>
    </div>
  );
}
function Fields({
  operation,
  language,
}: {
  operation: ApiOperation;
  language: Language;
}) {
  const t = words[language === "ar" ? "ar" : "en"],
    raw = operation.requestBody?.content["application/json"]?.schema;
  if (!raw) return null;
  const root = resolveSchema(raw),
    value = root.properties?.values
      ? resolveSchema(root.properties.values)
      : root;
  return (
    <div className="api-doc-table">
      <table>
        <caption>{t.body}</caption>
        <thead>
          <tr>
            <th>{t.field}</th>
            <th>{t.type}</th>
            <th>{t.required}</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(value.properties || {}).map(([name, schema]) => (
            <tr key={name}>
              <td>
                <code dir="ltr">
                  {root.properties?.values ? "values." : ""}
                  {name}
                </code>
              </td>
              <td dir="ltr">
                {schema.enum
                  ? schema.enum.join(" | ")
                  : String(schema.type || "object")}
              </td>
              <td>
                {value.required?.includes(name) ? t.required : t.optional}
              </td>
            </tr>
          ))}
          {root.properties?.values && root.properties.expectedRevision && (
            <tr>
              <td>
                <code>expectedRevision</code>
              </td>
              <td>integer</td>
              <td>{t.required}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export default function ApiDocumentation({ language }: { language: Language }) {
  const t = words[language === "ar" ? "ar" : "en"],
    [codeLanguage, setCodeLanguage] = useState<CodeLanguage>("curl"),
    [query, setQuery] = useState("");
  const filtered = operations.filter((o) =>
    (
      o.method +
      " " +
      o.path +
      " " +
      o.description +
      " " +
      o.operationId +
      " " +
      JSON.stringify(operationBody(o))
    )
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  const first = operations.find((o) => o.operationId === "listCourses")!;
  const sections = [
    ["quick", t.quick],
    ["auth", t.auth],
    ["workflow", t.workflow],
    ["reference", t.reference],
    ["errors", t.errors],
    ["security", t.security],
  ];
  const go = (id: string) => {
    const el = document.getElementById("api-doc-" + id);
    el?.scrollIntoView({ behavior: "instant", block: "start" });
    el?.focus({ preventScroll: true });
  };
  return (
    <article
      className="api-docs"
      dir={language === "ar" ? "rtl" : "ltr"}
      lang={language === "ar" ? "ar" : "en"}
    >
      <header className="api-doc-hero">
        <div>
          <p className="api-doc-eyebrow">
            WILO / DEVELOPERS · {t.version} {contract.info.version}
          </p>
          <h1>API Documentation</h1>
          <p>{t.intro}</p>
        </div>
        <div className="api-doc-links">
          <a href="#/settings" className="secondary-button">
            {t.back}
          </a>
          <a
            href="/openapi-public-api.json"
            download
            className="primary-button"
          >
            {t.download} ↓
          </a>
        </div>
      </header>
      <div className="api-doc-layout">
        <aside className="api-doc-nav">
          <nav aria-label="Documentation">
            {sections.map(([id, label]) => (
              <button type="button" key={id} onClick={() => go(id)}>
                {label}
              </button>
            ))}
          </nav>
          <label>
            {t.language}
            <select
              value={codeLanguage}
              onChange={(e) => setCodeLanguage(e.target.value as CodeLanguage)}
            >
              <option value="curl">cURL</option>
              <option value="python">Python requests</option>
              <option value="javascript">JavaScript fetch</option>
            </select>
          </label>
        </aside>
        <div className="api-doc-content">
          <section id="api-doc-quick" tabIndex={-1}>
            <h2>{t.quick}</h2>
            <ol className="api-doc-steps">
              {t.steps.map((step, i) => (
                <li key={i}>
                  {step}
                  {i === 0 && <a href="#/settings"> API Keys ↗</a>}
                </li>
              ))}
            </ol>
            <div className="api-doc-base">
              <span>Base URL</span>
              <code dir="ltr">{apiBase}</code>
            </div>
            <p>
              <strong>{t.scope}: </strong>
              <code>{first.scopes.join(", ")}</code>
            </p>
            <Code
              key={"first-" + codeLanguage}
              code={requestCode(first, codeLanguage)}
              language={language}
            />
          </section>
          <section id="api-doc-auth" tabIndex={-1}>
            <h2>{t.auth}</h2>
            <p>{t.authText}</p>
            <p>{t.runtime}</p>
            <details>
              <summary>User-Agent / 403</summary>
              <p>{t.agent}</p>
            </details>
          </section>
          <section id="api-doc-workflow" tabIndex={-1}>
            <h2>{t.workflow}</h2>
            <p>{t.flowText}</p>
            <Code
              key={"flow-" + codeLanguage}
              code={workflowCode(codeLanguage)}
              language={language}
            />
          </section>
          <section id="api-doc-reference" tabIndex={-1}>
            <h2>{t.reference}</h2>
            <p>{t.pagination}</p>
            <label className="api-doc-search">
              {t.search}
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
              />
            </label>
            <p role="status">
              {filtered.length} / {operations.length}
            </p>
            <div className="api-doc-operations">
              {filtered.map((op) => (
                <details
                  className="api-doc-operation"
                  key={op.id}
                  open={query.trim() ? true : undefined}
                >
                  <summary>
                    <span
                      className={
                        "api-doc-method api-doc-method-" +
                        op.method.toLowerCase()
                      }
                    >
                      {op.method}
                    </span>
                    <code dir="ltr">{op.path}</code>
                    <span className="api-doc-scope" dir="ltr">
                      {op.scopes.join(" · ")}
                    </span>
                  </summary>
                  <div className="api-doc-operation-body">
                    <p dir="ltr">{op.description}</p>
                    <p>
                      <strong>{t.scope}: </strong>
                      {op.scopes.map((s) => (
                        <code className="api-doc-tag" key={s}>
                          {s}
                        </code>
                      ))}
                    </p>
                    {op.parameters.length > 0 && (
                      <div>
                        <h3>{t.parameters}</h3>
                        <ul>
                          {op.parameters.map((p) => (
                            <li key={p.in + p.name}>
                              <code dir="ltr">{p.name}</code> ({p.in}) —{" "}
                              {p.required ? t.required : t.optional}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <Fields operation={op} language={language} />
                    <details className="api-doc-response-list">
                      <summary>{t.responses}</summary>
                      <ul>
                        {Object.entries(op.responses).map(([status, r]) => (
                          <li key={status} dir="ltr">
                            <code>{status}</code> — {r.description}
                          </li>
                        ))}
                      </ul>
                    </details>
                    <Code
                      key={op.id + codeLanguage}
                      code={requestCode(op, codeLanguage)}
                      language={language}
                    />
                  </div>
                </details>
              ))}
            </div>
            {!filtered.length && <p>{t.noResults}</p>}
          </section>
          <section id="api-doc-errors" tabIndex={-1}>
            <h2>{t.errors}</h2>
            <p>{t.errorsText}</p>
            <dl className="api-doc-errors">
              {(["401", "403", "429"] as const)
                .filter((code) => operations.some((o) => o.responses[code]))
                .map((code) => (
                  <div key={code}>
                    <dt>{code}</dt>
                    <dd>
                      {t.errorHelp[code]}
                      <Code
                        code={errorResponseCode(code)}
                        language={language}
                      />
                    </dd>
                  </div>
                ))}
            </dl>
            <p>{t.retry}</p>
            <p>{t.conflict}</p>
          </section>
          <section id="api-doc-security" tabIndex={-1}>
            <h2>{t.security}</h2>
            <p>{t.keySafety}</p>
            <p>{t.rotation}</p>
            <a href="#/settings" className="secondary-button">
              {t.back} ↗
            </a>
          </section>
        </div>
      </div>
    </article>
  );
}
