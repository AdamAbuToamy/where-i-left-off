import RoughMark from "./pinboard/RoughMark";
import { matchesView } from "../lib/projects";
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
/** Presentation only: original actions remain mounted; sorting stays with ProjectBoard's handle. */
export default function CompactCardShell({
  project,
  sections,
  language,
  children,
}: {
  project: Project;
  sections: Section[];
  language: Language;
  children: ReactNode;
}) {
  const { enabled, kitchenStudy } = useDesignPreview();
  const [expanded, setExpanded] = useState(false);
  const [marked, setMarked] = useState(false);
  const id = useId();
  const opener = useRef<HTMLButtonElement>(null),
    closer = useRef<HTMLButtonElement>(null);
  const t = labels[language];
  if (!enabled) return <>{children}</>;
  function open() {
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
      onPointerLeave={kitchenStudy ? () => setMarked(false) : undefined}
      onPointerEnter={kitchenStudy ? () => setMarked(true) : undefined}
      onFocus={kitchenStudy ? () => setMarked(true) : undefined}
      onBlur={
        kitchenStudy
          ? (event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                setMarked(false);
            }
          : undefined
      }
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
      {kitchenStudy && !expanded && (
        <span className="board-pin" aria-hidden="true" />
      )}
      {!expanded && (
        <div className="envelope-summary">
          <span className="envelope-section" dir="auto">
            {sections.find((s) => s.id === project.sectionId)?.name || "WILO"}
          </span>
          <h2 dir="auto">
            {kitchenStudy ? (
              <RoughMark active={marked} rtl={language !== "en"}>
                {project.name}
              </RoughMark>
            ) : (
              project.name
            )}
          </h2>
          <p
            className="envelope-copy"
            dir="auto"
            hidden={
              kitchenStudy &&
              !project.nextStep &&
              !project.checkpoint &&
              !project.description
            }
          >
            {project.nextStep ||
              project.checkpoint ||
              project.description ||
              t.empty}
          </p>
          {project.dueDate && (
            <time dateTime={project.dueDate}>
              <CalendarDays size={14} aria-hidden="true" />
              {kitchenStudy ? (
                <RoughMark
                  type="circle"
                  color="#a7473f"
                  active={matchesView(project, "overdue")}
                  rtl={language !== "en"}
                >
                  {project.dueDate}
                </RoughMark>
              ) : (
                project.dueDate
              )}
            </time>
          )}
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
            {kitchenStudy
              ? { ar: "فتح", en: "Open", he: "פתיחה" }[language]
              : t.open}
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
        {children}
      </div>
    </div>
  );
}
