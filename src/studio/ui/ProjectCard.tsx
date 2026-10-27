import type { ReactNode } from "react";
import {
  Check,
  Circle,
  Play,
  Archive,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink as LinkIcon,
} from "lucide-react";
import { motion } from "motion/react";
import type { Project } from "../../types";
import { useStudio } from "./context";
import { navigateStudio } from "./navigation";
import { DueLabel, MoreMenu } from "./primitives";
import type { StudioWord } from "./copy";
export default function StudioProjectCard({
  project,
  scopeId,
  selected,
  select,
  move,
  dragHandle,
}: {
  project: Project;
  scopeId: string;
  selected: boolean;
  select: () => void;
  move: (direction: -1 | 1) => void;
  dragHandle?: ReactNode;
}) {
  const { state, t, run, edit, focus } = useStudio(),
    scope = state.data.scopes.find((s) => s.id === scopeId)!;
  const readonly = scope.role === "member";
  const change = (values: Record<string, unknown>) =>
    run({
      kind: "actions",
      actions: [
        {
          target: "projects",
          action: "update",
          scope: scopeId,
          id: project.id,
          values,
        },
      ],
    });
  const progress = project.totalUnits
    ? Math.min(
        100,
        Math.round(((project.progressUnits || 0) / project.totalUnits) * 100),
      )
    : 0;
  return (
    <motion.article
      layout
      className={
        "st-project-card" +
        (selected ? " is-selected" : "") +
        (project.status === "done" ? " is-done" : "")
      }
      data-studio-card={project.id}
    >
      <div className="st-card-top">
        {dragHandle}
        <button
          className="st-select"
          type="button"
          aria-label={t("select") + " " + project.name}
          aria-pressed={selected}
          onClick={select}
          disabled={readonly}
        >
          {selected ? <Check size={15} /> : null}
        </button>
        <span className={"st-status st-status-" + project.status}>
          {t(project.status)}
        </span>
        <MoreMenu>
          <button
            onClick={() =>
              edit({ kind: "project", scope: scopeId, value: project })
            }
            disabled={readonly}
          >
            <Pencil size={15} />
            {t("edit")}
          </button>
          <button
            onClick={() => void change({ archivedAt: Date.now() })}
            disabled={readonly}
          >
            <Archive size={15} />
            {t("archive")}
          </button>
          <button onClick={() => move(-1)} disabled={readonly}>
            <ArrowUp size={15} />
            {t("up")}
          </button>
          <button onClick={() => move(1)} disabled={readonly}>
            <ArrowDown size={15} />
            {t("down")}
          </button>
          <button
            onClick={() =>
              void run({
                kind: "actions",
                actions: [
                  {
                    target: "projects",
                    action: "trash",
                    scope: scopeId,
                    id: project.id,
                  },
                ],
              })
            }
            disabled={readonly}
          >
            <Trash2 size={15} />
            {t("trash")}
          </button>
        </MoreMenu>
      </div>
      <span className="st-card-type">
        {t((project.resourceType || "project") as StudioWord)} ·{" "}
        <span dir="auto">
          {scope.sections.find((s) => s.id === project.sectionId)?.name ||
            t("unassigned")}
        </span>
      </span>
      <button
        className="st-card-title"
        onClick={() =>
          navigateStudio({
            screen: scopeId === "personal" ? "projects" : "groups",
            scope: scopeId,
            item: project.id,
          })
        }
      >
        <h3 dir="auto">{project.name}</h3>
      </button>
      <p className="st-card-step" dir="auto">
        {project.nextStep || t("emptyHint")}
      </p>
      {!!project.totalUnits && (
        <div className="st-progress">
          <progress max={100} value={progress} aria-label={t("progress")} />
          <span>
            {project.progressUnits || 0} / {project.totalUnits}
          </span>
        </div>
      )}
      <div className="st-card-footer">
        <DueLabel value={project.dueDate || project.followUpDate || ""} />
        {project.projectUrl && <LinkIcon size={14} aria-label={t("links")} />}
        <div>
          <button
            className="st-icon-button"
            aria-label={t("startFocus") + " " + project.name}
            onClick={() => focus(project.id, project.name)}
          >
            <Play size={16} />
          </button>
          <button
            className="st-icon-button"
            aria-label={
              (project.status === "done" ? t("reopen") : t("complete")) +
              " " +
              project.name
            }
            onClick={() =>
              void change({
                status: project.status === "done" ? "active" : "done",
              })
            }
            disabled={readonly}
          >
            {project.status === "done" ? (
              <Check size={18} />
            ) : (
              <Circle size={18} />
            )}
          </button>
        </div>
      </div>
    </motion.article>
  );
}
