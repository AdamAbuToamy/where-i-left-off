import { useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Maximize2, Minimize2, CalendarDays } from "lucide-react";
import type { Project, Section } from "../types";
import type { Language } from "../translations";
import { useDesignPreview } from "./designPreviewContext";
const labels = {
  ar: {
    open: "تكبير البطاقة",
    close: "تصغير البطاقة",
    empty: "افتح البطاقة لعرض التفاصيل",
  },
  he: {
    open: "הרחבת הכרטיס",
    close: "צמצום הכרטיס",
    empty: "פתחו את הכרטיס לפרטים",
  },
  en: {
    open: "Expand card",
    close: "Collapse card",
    empty: "Open card to see details",
  },
};
/** Presentation only: details mount on first open and remain mounted thereafter; sorting stays with ProjectBoard's handle. */
export default function CompactCardShell({
  project,
  sections,
  language,
  children,
  summaryExtras,
  expanded: controlledExpanded,
  onExpandedChange,
}: {
  project: Project;
  sections: Section[];
  language: Language;
  children: ReactNode;
  summaryExtras?: ReactNode;
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
}) {
  const { enabled } = useDesignPreview();
  const [visited, setVisited] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const setExpanded = onExpandedChange || setLocalExpanded;
  const id = useId();
  const opener = useRef<HTMLButtonElement>(null),
    closer = useRef<HTMLButtonElement>(null);
  const t = labels[language];
  if (!enabled) return <>{children}</>;
  function open() {
    setVisited(true);
    setExpanded(true);
    requestAnimationFrame(() => closer.current?.focus({ preventScroll: true }));
  }
  function close() {
    setExpanded(false);
    requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
  }
  return (
    <div
      className={`envelope-shell ${expanded ? "is-expanded" : ""}`}
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          expanded &&
          !(event.target as HTMLElement).closest('dialog,[role="dialog"],form')
        ) {
          event.preventDefault();
          close();
        }
      }}
    >
      {!expanded && (
        <div className="envelope-summary">
          <span className="envelope-section" dir="auto">
            {sections.find((s) => s.id === project.sectionId)?.name || "WILO"}
          </span>
          <h2 dir="auto">{project.name}</h2>
          <p className="envelope-copy" dir="auto">
            {project.nextStep ||
              project.checkpoint ||
              project.description ||
              t.empty}
          </p>
          {project.dueDate && (
            <time dateTime={project.dueDate}>
              <CalendarDays size={14} aria-hidden="true" />
              {project.dueDate}
            </time>
          )}
          {summaryExtras}
          <button
            ref={opener}
            type="button"
            className="envelope-expand"
            aria-label={`${t.open}: ${project.name}`}
            aria-expanded={false}
            aria-controls={id}
            onClick={open}
          >
            <Maximize2 size={18} aria-hidden="true" />
            <span className="envelope-expand-label">{t.open}</span>
            <span className="envelope-expand-short" aria-hidden="true">
              {language === "ar" ? "فتح" : language === "he" ? "פתח" : "Open"}
            </span>
          </button>
        </div>
      )}
      <div
        className="envelope-content"
        id={id}
        hidden={!expanded}
        inert={!expanded}
      >
        <div className="envelope-expanded-toolbar">
          <button
            ref={closer}
            type="button"
            className="envelope-collapse"
            aria-expanded={true}
            aria-controls={id}
            onClick={close}
          >
            <Minimize2 size={16} aria-hidden="true" />
            {t.close}
          </button>
        </div>
        {(visited || expanded) && children}
      </div>
    </div>
  );
}
