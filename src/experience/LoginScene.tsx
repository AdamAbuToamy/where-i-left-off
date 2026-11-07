import { useState } from "react";
import { ArrowUpRight, MoveUpRight, RotateCcw, Check } from "lucide-react";
import type { Language } from "../translations";
import "./cinematic.css";
const copy = {
  ar: {
    eyebrow: "مساحة لما تبدأه",
    title: "كل بداية تستحق عودة.",
    body: "فكرتك، خطوتك، والمكان الذي وصلت إليه.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    enter: "ادخل إلى مساحتك",
    ready: "عدت إلى المسار.",
    next: "الخطوة القادمة",
    task: "أكمل رسم فكرتك",
    reset: "شاهد الدخول مجددًا",
    preview: "معاينة فقط — لا تُرسل بيانات ولا تُسجّل دخولًا",
  },
  en: {
    eyebrow: "A place for what you start",
    title: "Every beginning deserves a return.",
    body: "Your idea, your next step, and where you left off.",
    email: "Email",
    password: "Password",
    enter: "Enter your workspace",
    ready: "Back on track.",
    next: "Next step",
    task: "Continue sketching your idea",
    reset: "Replay the entrance",
    preview: "Preview only — no data is sent and no sign-in occurs",
  },
  he: {
    eyebrow: "מקום למה שהתחלתם",
    title: "לכל התחלה מגיעה חזרה.",
    body: "הרעיון, הצעד הבא והנקודה שבה עצרתם.",
    email: "אימייל",
    password: "סיסמה",
    enter: "כניסה למרחב שלכם",
    ready: "חוזרים למסלול.",
    next: "הצעד הבא",
    task: "להמשיך לשרטט את הרעיון",
    reset: "הפעלת הכניסה מחדש",
    preview: "תצוגה בלבד — אין שליחת נתונים או כניסה לחשבון",
  },
};
/** An isolated visual rehearsal; intentionally has no auth or persistence collaborators. */
export default function LoginScene({ language }: { language: Language }) {
  const t = copy[language],
    [entered, setEntered] = useState(false);
  return (
    <section
      className="login-scene"
      data-entered={entered}
      dir={language === "en" ? "ltr" : "rtl"}
      aria-label={t.preview}
    >
      <div className="scene-sky" aria-hidden="true">
        <i className="scene-sun" />
        <svg viewBox="0 0 1200 600" preserveAspectRatio="none">
          <path d="M0 450 Q250 260 500 435 T1200 350V600H0Z" />
          <path d="M0 520 Q400 310 700 490 T1200 450V600H0Z" />
        </svg>
        <div className="scene-horizon" />
      </div>
      <div className="scene-brand" dir="ltr">
        WILO<span>WHERE I LEFT OFF</span>
      </div>
      <div className="scene-story">
        <span>{t.eyebrow}</span>
        <h2>{t.title}</h2>
        <p>{t.body}</p>
        <svg viewBox="0 0 340 120" aria-hidden="true">
          <path d="M5 90 C75 12 110 130 180 50 S260 20 328 30" />
          <circle cx="328" cy="30" r="4" />
        </svg>
      </div>
      <div className="scene-panel" key={entered ? "arrival" : "entry"}>
        <div className="scene-mark" aria-hidden="true">
          {entered ? <Check /> : <MoveUpRight />}
        </div>
        <h3>{entered ? t.ready : t.enter}</h3>
        {!entered ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setEntered(true);
            }}
          >
            <label>
              {t.email}
              <input
                type="email"
                placeholder="you@example.com"
                autoComplete="off"
                aria-label={t.email}
              />
            </label>
            <label>
              {t.password}
              <input
                type="password"
                placeholder="••••••••"
                autoComplete="off"
                aria-label={t.password}
              />
            </label>
            <button type="submit">
              {t.enter}
              <ArrowUpRight size={20} />
            </button>
          </form>
        ) : (
          <>
            <article className="scene-arrival-card">
              <small>{t.next}</small>
              <strong>{t.task}</strong>
              <span>01 / 03</span>
              <i />
            </article>
            <button
              className="scene-reset"
              type="button"
              onClick={() => setEntered(false)}
            >
              <RotateCcw size={16} />
              {t.reset}
            </button>
          </>
        )}
      </div>
      <small className="scene-caption">{t.preview}</small>
    </section>
  );
}
