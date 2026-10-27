import {
  Archive,
  Lightbulb,
  RotateCcw,
  Trash2,
  ArrowUpRight,
} from "lucide-react";
import { DAY_MS } from "../../lib/workflow";
import { useStudio } from "./context";
import { navigateStudio } from "./navigation";
import { EmptyState, DueLabel } from "./primitives";
export default function StudioLibrary() {
  const { state, route, t, now, run } = useStudio();
  const kind = ["archive", "trash", "review", "ideas"].includes(route.library)
    ? route.library
    : "archive";
  const rows = state.data.scopes.flatMap((scope) =>
    scope.projects
      .filter((project) =>
        kind === "trash"
          ? !!project.trashedAt
          : kind === "archive"
            ? !!project.archivedAt && !project.trashedAt
            : !project.trashedAt &&
              !project.archivedAt &&
              (kind === "ideas"
                ? project.resourceType === "idea"
                : project.status !== "done" &&
                  (project.followUpDate
                    ? Date.parse(project.followUpDate) <= now
                    : now - (project.activityAt || now) >
                      state.settings.reviewDays * DAY_MS)),
      )
      .map((project) => ({ scope, project })),
  );
  return (
    <section>
      <header className="st-section-header">
        <div>
          <span className="st-eyebrow">WILO / {t("library")}</span>
          <h1>{t("library")}</h1>
        </div>
        <Archive size={28} />
      </header>
      <nav className="st-tab-row" aria-label={t("library")}>
        {(["archive", "trash", "review", "ideas"] as const).map((value) => (
          <button
            key={value}
            aria-pressed={kind === value}
            onClick={() => navigateStudio({ library: value })}
          >
            {t(value)}
          </button>
        ))}
      </nav>
      <div className="st-library-grid">
        {rows.map(({ scope, project }) => (
          <article
            className="st-surface st-library-card"
            key={scope.id + project.id}
          >
            {kind === "ideas" ? (
              <Lightbulb size={23} />
            ) : kind === "trash" ? (
              <Trash2 size={23} />
            ) : (
              <Archive size={23} />
            )}
            <small dir="auto">{scope.name}</small>
            <h3 dir="auto">{project.name}</h3>
            <p dir="auto">{project.checkpoint || project.nextStep}</p>
            <DueLabel value={project.dueDate || ""} />
            <div className="st-dialog-actions">
              {kind === "archive" || kind === "trash" ? (
                <button
                  className="st-secondary"
                  disabled={scope.role === "member"}
                  onClick={() =>
                    void run({
                      kind: "actions",
                      actions: [
                        {
                          target: "projects",
                          action: "update",
                          scope: scope.id,
                          id: project.id,
                          values: { archivedAt: 0, trashedAt: 0 },
                        },
                      ],
                    })
                  }
                >
                  <RotateCcw size={16} />
                  {t("restore")}
                </button>
              ) : (
                <>
                  <button
                    className="st-primary"
                    onClick={() =>
                      navigateStudio({
                        screen: scope.id === "personal" ? "projects" : "groups",
                        scope: scope.id,
                        item: project.id,
                      })
                    }
                  >
                    {t("open")}
                    <ArrowUpRight size={15} />
                  </button>
                  <button
                    className="st-secondary"
                    disabled={scope.role === "member"}
                    onClick={() =>
                      void run({
                        kind: "actions",
                        actions: [
                          {
                            target: "projects",
                            action: "update",
                            scope: scope.id,
                            id: project.id,
                            values: {
                              resourceType:
                                project.resourceType === "idea"
                                  ? "project"
                                  : project.resourceType,
                              status: "active",
                              activityAt: now,
                            },
                          },
                        ],
                      })
                    }
                  >
                    {t("active")}
                  </button>
                </>
              )}
              {kind === "trash" && scope.id === "personal" && (
                <button
                  className="st-secondary"
                  onClick={() => {
                    if (window.confirm(t("delete") + " — " + project.name))
                      void run({
                        kind: "actions",
                        actions: [
                          {
                            target: "projects",
                            action: "delete",
                            scope: scope.id,
                            id: project.id,
                          },
                        ],
                      });
                  }}
                >
                  {t("delete")}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!rows.length && <EmptyState />}
    </section>
  );
}
