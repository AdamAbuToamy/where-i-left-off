import { usePhoneLayout } from "./usePhoneSurface";
import LanguagePicker from "./LanguagePicker";
import { cloudText } from "../cloudTranslations";
import { useDesignPreview } from "./designPreviewContext";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import type { Language } from "../translations";
import type { PageName } from "../lib/navigation";
import { pageText } from "../pageText";
import { workflowText } from "../workflowText";

const labels = { en: "Menu", ar: "القائمة", he: "תפריט" };
const paths: Record<string, string> = {
  university: "M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3z M12 6v16",
  resume: "m9 5 10 7-10 7z",
  personal: "M3 7h7l2 2h9v11H3z M3 7V4h7l2 3",
  groups:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 4a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-4",
  library: "M3 5h18v4H3z M5 9v12h14V9 M10 13h4",
  analytics: "M4 20h17 M7 16V9 M12 16V4 M17 16v-5",
  settings: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M9 15v6",
  admin: "M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7z M9 12l2 2 4-4",
};
export default function SideNavigation({
  language,
  page,
  admin,
  onSignOut,
  onLanguageChange,
}: {
  language: Language;
  page: PageName;
  admin: boolean;
  onSignOut?: () => void;
  onLanguageChange?: (language: Language) => void;
}) {
  const [open, setOpen] = useState(false),
    root = useRef<HTMLDivElement>(null),
    toggle = useRef<HTMLButtonElement>(null),
    id = useId();
  const { enabled, kitchenStudy } = useDesignPreview();
  const reduced = useReducedMotion();
  const phone = usePhoneLayout();
  const t = pageText[language],
    w = workflowText[language];
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (
        !(e.target as HTMLElement).closest(".mobile-menu-toggle") &&
        !root.current?.contains(e.target as Node)
      )
        setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        root.current?.contains(document.activeElement)
      ) {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    const show = () => {
      setOpen((value) => !value);
      requestAnimationFrame(() =>
        root.current?.querySelector<HTMLAnchorElement>("nav a")?.focus(),
      );
    };
    window.addEventListener("wilo-open-menu", show);
    return () => window.removeEventListener("wilo-open-menu", show);
  }, []);
  return (
    <LayoutGroup id={id}>
      <div
        ref={root}
        className={`side-navigation ${open ? "is-open" : ""}`}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") setOpen(true);
        }}
        onPointerLeave={(event) => {
          if (
            event.pointerType === "mouse" &&
            innerWidth > 600 &&
            !root.current?.contains(document.activeElement)
          )
            setOpen(false);
        }}
        onBlur={(e) => {
          if (
            e.relatedTarget instanceof Node &&
            !e.currentTarget.contains(e.relatedTarget)
          )
            setOpen(false);
        }}
      >
        <button
          ref={toggle}
          type="button"
          className="side-navigation-toggle"
          aria-expanded={open}
          aria-controls={id}
          onClick={(event) => {
            if (
              enabled &&
              "pointerType" in event.nativeEvent &&
              event.nativeEvent.pointerType === "mouse"
            )
              setOpen(true);
            else setOpen((v) => !v);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              requestAnimationFrame(() =>
                root.current
                  ?.querySelector<HTMLAnchorElement>("nav a")
                  ?.focus(),
              );
            }
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path
              d={open ? "m6 6 12 12 M18 6 6 18" : "M4 6h16 M4 12h16 M4 18h16"}
            />
          </svg>
          <span>{labels[language]}</span>
        </button>
        <nav
          id={id}
          className="page-navigation"
          aria-label={labels[language]}
          aria-hidden={!open}
          inert={!open}
          onFocus={() => setOpen(true)}
        >
          {kitchenStudy && (
            <header className="mobile-menu-heading">
              <strong>
                {language === "ar"
                  ? "القائمة"
                  : language === "he"
                    ? "תפריט"
                    : "Menu"}
              </strong>
              <button
                type="button"
                className="secondary-button"
                onClick={() => setOpen(false)}
              >
                {language === "ar"
                  ? "رجوع"
                  : language === "he"
                    ? "חזרה"
                    : "Back"}
              </button>
            </header>
          )}
          {(
            [
              "resume",
              "personal",
              "groups",
              "library",
              "analytics",
              "university",
              "settings",
              ...(admin ? ["admin"] : []),
            ] as PageName[]
          )
            .filter(
              (item) =>
                !(
                  kitchenStudy &&
                  phone &&
                  ["personal", "university"].includes(item)
                ),
            )
            .map((item) => (
              <a
                key={item}
                href={`#/${item}`}
                aria-current={page === item ? "page" : undefined}
                onClick={() => {
                  setOpen(false);
                  toggle.current?.focus();
                }}
              >
                {page === item && (
                  <motion.span
                    className="site-navigation-marker"
                    layoutId="active-page"
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 34,
                      duration: reduced ? 0 : undefined,
                    }}
                    aria-hidden="true"
                  />
                )}
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={paths[item]} />
                </svg>
                <span>
                  {item === "university"
                    ? { ar: "الجامعة", en: "University", he: "אוניברסיטה" }[
                        language
                      ]
                    : item === "library"
                      ? w.library
                      : item === "analytics"
                        ? w.analytics
                        : t[item as keyof typeof t]}
                </span>
              </a>
            ))}
          {kitchenStudy && (
            <div className="mobile-menu-account">
              {onLanguageChange && (
                <LanguagePicker
                  language={language}
                  onChange={(value) => {
                    onLanguageChange(value);
                    setOpen(false);
                  }}
                />
              )}
              <button
                type="button"
                className="secondary-button"
                onClick={onSignOut}
              >
                {cloudText[language].logout}
              </button>
            </div>
          )}
        </nav>
      </div>
    </LayoutGroup>
  );
}
