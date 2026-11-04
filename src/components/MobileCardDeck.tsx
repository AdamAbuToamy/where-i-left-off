import CardPreviewDetails from "./CardPreviewDetails";
import { useRef, useState, useLayoutEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProjectCard from "./ProjectCard";
import type { ProjectBoardProps } from "./ProjectBoard";
export default function MobileCardDeck({
  disabled,
  projects,
  sections,
  language,
  groupId,
  members,
  currentUid,
  canManage = true,
  onToggle,
  onUpdate,
  onDelete,
}: ProjectBoardProps) {
  const root = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    root.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, []);
  const [activeId, setActiveId] = useState(""),
    surface = useRef<HTMLDivElement>(null),
    gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const index = Math.max(
      0,
      projects.findIndex((p) => p.id === activeId),
    ),
    project = projects[index],
    rtl = language !== "en";
  function step(delta: number) {
    const next =
      projects[Math.max(0, Math.min(projects.length - 1, index + delta))];
    if (next) setActiveId(next.id);
  }
  if (!project) return null;
  return (
    <section
      ref={root}
      className="mobile-card-deck"
      aria-label={language === "ar" ? "عرض بطاقة واحدة" : "Single card view"}
    >
      <div className="mobile-deck-navigation">
        <button
          type="button"
          disabled={index === 0}
          aria-label={language === "ar" ? "البطاقة السابقة" : "Previous card"}
          onClick={() => step(-1)}
        >
          {rtl ? <ChevronRight size={22} /> : <ChevronLeft size={22} />}
        </button>
        <span role="status" dir="ltr">
          {index + 1} / {projects.length}
        </span>
        <button
          type="button"
          disabled={index === projects.length - 1}
          aria-label={language === "ar" ? "البطاقة التالية" : "Next card"}
          onClick={() => step(1)}
        >
          {rtl ? <ChevronLeft size={22} /> : <ChevronRight size={22} />}
        </button>
      </div>
      <div
        ref={surface}
        className="mobile-deck-swipe"
        onPointerDown={(e) => {
          if (
            e.button !== 0 ||
            (e.target as HTMLElement).closest(
              "button,a,input,textarea,select,summary,.envelope-content,.phone-card-fullscreen",
            )
          )
            return;
          if (e.pointerType === "mouse") e.preventDefault();
          gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.id !== e.pointerId) return;
          const dx = e.clientX - g.x,
            dy = e.clientY - g.y;
          if (Math.abs(dx) > Math.abs(dy))
            e.currentTarget.style.setProperty(
              "--swipe-transform",
              "translateX(" + Math.max(-100, Math.min(100, dx * 0.45)) + "px)",
            );
        }}
        onPointerUp={(e) => {
          const g = gesture.current;
          gesture.current = null;
          e.currentTarget.style.removeProperty("--swipe-transform");
          if (
            g &&
            Math.abs(e.clientX - g.x) > 65 &&
            Math.abs(e.clientX - g.x) > Math.abs(e.clientY - g.y) * 1.25
          )
            step((e.clientX - g.x) * (rtl ? -1 : 1) < 0 ? 1 : -1);
        }}
        onPointerCancel={(e) => {
          gesture.current = null;
          e.currentTarget.style.removeProperty("--swipe-transform");
        }}
      >
        <div key={project.id} className="mobile-deck-card">
          <ProjectCard
            summaryExtras={
              <CardPreviewDetails project={project} language={language} />
            }
            disabled={disabled}
            project={project}
            sections={sections}
            language={language}
            groupId={groupId}
            members={members}
            canManage={canManage}
            canEdit={canManage || project.assignedTo === currentUid}
            onToggle={onToggle}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        </div>
      </div>
    </section>
  );
}
