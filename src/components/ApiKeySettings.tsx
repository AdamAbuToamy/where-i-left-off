import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import type { Language } from "../translations";
import { accountApiKeys } from "../lib/apiKeys";
import type { ApiKeyMetadata } from "../lib/apiKeys";
import "./apiKeys.css";
const categories = [
  "courses",
  "tasks",
  "schedule",
  "projects",
  "sections",
  "boards",
  "reminders",
];
const names = {
  ar: [
    "المقررات",
    "الواجبات والاختبارات",
    "المحاضرات",
    "البطاقات والمشاريع",
    "الأقسام",
    "اللوح الشخصي",
    "التذكيرات",
  ],
  en: [
    "Courses",
    "Assignments and exams",
    "Classes",
    "Cards and projects",
    "Sections",
    "Personal board",
    "Reminders",
  ],
  he: [
    "קורסים",
    "מטלות ובחינות",
    "שיעורים",
    "כרטיסים ופרויקטים",
    "קטגוריות",
    "לוח אישי",
    "תזכורות",
  ],
};
const text = {
  ar: {
    intro:
      "اسمح لتطبيقاتك وأتمتتك بالوصول إلى حسابك بصلاحيات تختارها. لا تمنح المفتاح صلاحيات لا يحتاجها.",
    name: "اسم المفتاح",
    expiry: "انتهاء الصلاحية (اختياري)",
    read: "قراءة",
    write: "إضافة وتحديث",
    create: "إنشاء API Key",
    copy: "نسخ المفتاح",
    copied: "تم النسخ",
    close: "حفظت المفتاح، إغلاق",
    once: "احفظ المفتاح الآن. يظهر مرة واحدة فقط، ولن تتمكن أنت أو الإدارة من استرجاعه لاحقًا.",
    warning:
      "هذا المفتاح خاص بك. أي شخص يمتلكه قد يتمكن من الوصول إلى بيانات حسابك ضمن الصلاحيات الممنوحة له. لا تشاركه مع الآخرين أو تضعه في مستودعات عامة.",
    revoke: "إلغاء",
    rotate: "استبدال وإلغاء القديم",
    confirm: "سيُلغى المفتاح القديم فورًا. هل تريد المتابعة؟",
    empty: "لم تنشئ مفاتيح بعد.",
    error: "تعذر إكمال العملية. تحقق من الاتصال وحاول مجددًا.",
    created: "أُنشئ",
    last: "آخر استخدام",
    never: "لم يُستخدم",
    none: "بلا انتهاء",
    active: "نشط",
    expired: "منتهي",
    revoked: "ملغى",
  },
  en: {
    intro:
      "Give your applications access to your account with only the permissions they need.",
    name: "Key name",
    expiry: "Expiry (optional)",
    read: "Read",
    write: "Create and update",
    create: "Create API Key",
    copy: "Copy key",
    copied: "Copied",
    close: "I saved the key — close",
    once: "Save this key now. It is displayed only once. Neither you nor an administrator can recover it later.",
    warning:
      "This key is private. Anyone who has it can access your account within its scopes. Do not share it or put it in public repositories.",
    revoke: "Revoke",
    rotate: "Replace and revoke old key",
    confirm: "The old key will be revoked immediately. Continue?",
    empty: "No API keys yet.",
    error: "The operation failed. Check your connection and try again.",
    created: "Created",
    last: "Last used",
    never: "Never used",
    none: "No expiry",
    active: "Active",
    expired: "Expired",
    revoked: "Revoked",
  },
  he: {
    intro: "אפשרו ליישומים גישה לחשבון רק בהרשאות הדרושות להם.",
    name: "שם המפתח",
    expiry: "תוקף (אופציונלי)",
    read: "קריאה",
    write: "יצירה ועדכון",
    create: "יצירת API Key",
    copy: "העתקת מפתח",
    copied: "הועתק",
    close: "שמרתי את המפתח — סגירה",
    once: "שמרו את המפתח עכשיו. הוא מוצג פעם אחת בלבד ולא ניתן לשחזור גם על ידי מנהל.",
    warning:
      "המפתח פרטי. כל המחזיק בו יכול לגשת לנתונים בהתאם להרשאות. אין לשתף אותו או לשמור במאגר ציבורי.",
    revoke: "ביטול",
    rotate: "החלפה וביטול הישן",
    confirm: "המפתח הישן יבוטל מיד. להמשיך?",
    empty: "אין מפתחות עדיין.",
    error: "הפעולה נכשלה. בדקו חיבור ונסו שוב.",
    created: "נוצר",
    last: "שימוש אחרון",
    never: "טרם נעשה שימוש",
    none: "ללא תפוגה",
    active: "פעיל",
    expired: "פג תוקף",
    revoked: "בוטל",
  },
};
export default function ApiKeySettings({
  user,
  language,
}: {
  user: User;
  language: Language;
}) {
  const [limits] = useState(() => ({
    min: new Date().toISOString().slice(0, 10),
    max: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  }));
  const t = text[language],
    dialog = useRef<HTMLDialogElement>(null),
    mounted = useRef(true);
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([]),
    [name, setName] = useState(""),
    [expiry, setExpiry] = useState(""),
    [scopes, setScopes] = useState<string[]>([]),
    [secret, setSecret] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    mounted.current = true;
    let current = true;
    void accountApiKeys(user, { action: "list" })
      .then((r) => {
        if (current) setKeys(r.keys || []);
      })
      .catch(() => {
        if (current) setError(true);
      });
    return () => {
      current = false;
      mounted.current = false;
    };
  }, [user]);
  useEffect(() => {
    if (secret) dialog.current?.showModal();
  }, [secret]);
  const close = () => {
    dialog.current?.close();
    setSecret("");
    setCopied(false);
  };
  useEffect(() => {
    const hide = () => {
      if (document.visibilityState === "hidden") {
        dialog.current?.close();
        setSecret("");
        setCopied(false);
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  async function perform(data: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const r = await accountApiKeys(user, data);
      if (!mounted.current) return;
      if (r.key) {
        // A response can arrive after visibilitychange already erased the dialog.
        // Never retain a newly issued credential while the tab is hidden.
        if (document.visibilityState === "hidden") setError(true);
        else setSecret(r.key);
        setCopied(false);
        setName("");
      }
      const list = await accountApiKeys(user, { action: "list" });
      if (mounted.current) setKeys(list.keys || []);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const date = (value: number | null) =>
    value ? new Date(value).toLocaleString(language) : t.never;
  return (
    <section className="settings-section api-keys">
      <h3>API Keys</h3>
      <p>{t.intro}</p>
      <p className="api-key-warning">{t.warning}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void perform({
            action: "create",
            name,
            scopes,
            expiresAt: expiry ? new Date(expiry + "T23:59:59").getTime() : null,
          });
        }}
      >
        <label>
          {t.name}
          <input
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </label>
        <label>
          {t.expiry}
          <input
            type="date"
            value={expiry}
            min={limits.min}
            max={limits.max}
            onChange={(e) => setExpiry(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>
            {language === "ar"
              ? "الصلاحيات (Scopes)"
              : language === "he"
                ? "הרשאות (Scopes)"
                : "Scopes"}
          </legend>
          {categories.map((c, i) => (
            <div className="api-scope-row" key={c}>
              <span>{names[language][i]}</span>
              {["read", "write"].map((mode) => (
                <label key={mode}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(c + ":" + mode)}
                    onChange={(e) =>
                      setScopes((s) =>
                        e.target.checked
                          ? [...s, c + ":" + mode]
                          : s.filter((v) => v !== c + ":" + mode),
                      )
                    }
                  />
                  {mode === "read" ? t.read : t.write}
                </label>
              ))}
            </div>
          ))}
        </fieldset>
        <button
          className="primary-button"
          disabled={busy || !name.trim() || !scopes.length}
        >
          {t.create}
        </button>
      </form>
      {error && <p role="alert">{t.error}</p>}
      {!keys.length && <p>{t.empty}</p>}
      <ul className="api-key-list">
        {keys.map((k) => (
          <li key={k.id}>
            <header>
              <strong dir="auto">{k.name}</strong>
              <span>{t[k.status]}</span>
            </header>
            <p>
              {t.created}: {date(k.createdAt)} · {t.last}: {date(k.lastUsedAt)}
            </p>
            <p>
              {t.expiry}: {k.expiresAt ? date(k.expiresAt) : t.none}
            </p>
            <div className="api-scope-tags">
              {k.scopes.map((s) => (
                <code key={s}>{s}</code>
              ))}
            </div>
            {k.status !== "revoked" && (
              <div className="api-key-actions">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(t.confirm))
                      void perform({ action: "revoke", id: k.id });
                  }}
                >
                  {t.revoke}
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || k.status !== "active"}
                  onClick={() => {
                    if (window.confirm(t.confirm))
                      void perform({
                        action: "rotate",
                        id: k.id,
                      });
                  }}
                >
                  {t.rotate}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        className="api-secret-dialog"
        onCancel={close}
        onClose={() => {
          setSecret("");
          setCopied(false);
        }}
        aria-labelledby="api-secret-title"
      >
        <h3 id="api-secret-title">{t.once}</h3>
        <p>{t.warning}</p>
        {secret && (
          <>
            <textarea
              aria-label="API Key"
              readOnly
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              value={secret}
            />
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                void navigator.clipboard
                  .writeText(secret)
                  .then(() => setCopied(true))
                  .catch(() => setError(true));
              }}
            >
              {copied ? t.copied : t.copy}
            </button>
          </>
        )}
        <button type="button" className="secondary-button" onClick={close}>
          {t.close}
        </button>
      </dialog>
    </section>
  );
}
