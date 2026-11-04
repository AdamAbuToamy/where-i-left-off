import { requestAssistantOpen } from "../assistant/launcherCommands";
import {
  PanelsTopLeft,
  GraduationCap,
  Sparkles,
  CalendarDays,
  Menu,
} from "lucide-react";
import type { Language } from "../translations";
import type { PageName } from "../lib/navigation";
export default function MobileNavigation({
  uid,
  language,
  page,
}: {
  uid: string;
  language: Language;
  page: PageName;
}) {
  const t =
    language === "ar"
      ? ["البطاقات", "الجامعة", "ويلو", "الأسبوع", "المزيد"]
      : language === "he"
        ? ["כרטיסים", "אוניברסיטה", "Wilo", "שבוע", "עוד"]
        : ["Cards", "University", "Wilo", "Week", "More"];
  return (
    <nav
      className="mobile-bottom-navigation"
      aria-label={language === "ar" ? "التنقل السفلي" : "Bottom navigation"}
    >
      <a
        href="#/personal"
        aria-current={page === "personal" ? "page" : undefined}
      >
        <PanelsTopLeft size={21} />
        <span>{t[0]}</span>
      </a>
      <a
        href="#/university"
        aria-current={page === "university" ? "page" : undefined}
      >
        <GraduationCap size={21} />
        <span>{t[1]}</span>
      </a>
      <button
        type="button"
        className="mobile-wilo-action"
        aria-label={language === "ar" ? "فتح المساعد" : "Open assistant"}
        onClick={() => requestAssistantOpen(uid)}
      >
        <Sparkles size={27} />
        <span>{t[2]}</span>
      </button>
      <a href="#/personal?view=week">
        <CalendarDays size={21} />
        <span>{t[3]}</span>
      </a>
      <button
        type="button"
        className="mobile-menu-toggle"
        onClick={() => window.dispatchEvent(new Event("wilo-open-menu"))}
      >
        <Menu size={21} />
        <span>{t[4]}</span>
      </button>
    </nav>
  );
}
