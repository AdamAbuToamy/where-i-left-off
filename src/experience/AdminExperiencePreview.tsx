import { useState } from "react";
import { Clapperboard, ChevronDown } from "lucide-react";
import type { Language } from "../translations";
import LoginScene from "./LoginScene";
import ExperienceSettings from "./ExperienceSettings";
export default function AdminExperiencePreview({
  uid,
  language,
}: {
  uid: string;
  language: Language;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="admin-experience-preview">
      <header>
        <div>
          <small>WILO / STUDIO</small>
          <h3>
            {language === "ar"
              ? "الدخول والحركة — تجربة الإدارة"
              : language === "he"
                ? "כניסה ותנועה — תצוגת מנהל"
                : "Entrance & motion — admin preview"}
          </h3>
        </div>
        <button
          type="button"
          className="primary-button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Clapperboard size={18} />
          {language === "ar"
            ? "معاينة الدخول"
            : language === "he"
              ? "תצוגת כניסה"
              : "Preview entrance"}
          <ChevronDown size={17} />
        </button>
      </header>
      {open && <LoginScene language={language} />}
      <ExperienceSettings uid={uid} language={language} />
    </section>
  );
}
