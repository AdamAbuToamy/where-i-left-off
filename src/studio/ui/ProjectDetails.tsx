import { Play, Pencil, Sparkles } from "lucide-react";
import LinkedText from "../../components/LinkedText";
import { checklistItems } from "../../lib/taskOverview";
import { toggleChecklist } from "../../lib/projects";
import { useStudio } from "./context";
import { navigateStudio } from "./navigation";
import { StudioDialog, DueLabel, ExternalLink } from "./primitives";
export default function ProjectDetails() {
  const { state, route, t, edit, run, ask, focus } = useStudio(),
    scope = state.data.scopes.find((s) => s.id === route.scope),
    project = scope?.projects.find((p) => p.id === route.item);
  if (!project || !scope) return null;
  return (
    <StudioDialog
      title={project.name}
      close={() => navigateStudio({ item: "" })}
    >
      <div className="st-detail-stack">
        <span className={"st-status st-status-" + project.status}>
          {t(project.status)}
        </span>
        <DueLabel value={project.dueDate || ""} />
        <div className="st-detail-next">
          <h3>{t("nextStep")}</h3>
          <p dir="auto">
            <LinkedText text={project.nextStep || t("emptyHint")} />
          </p>
        </div>
        {project.checkpoint && (
          <section>
            <h3>{t("checkpoint")}</h3>
            <p dir="auto">
              <LinkedText text={project.checkpoint} />
            </p>
          </section>
        )}
        {project.description && (
          <section>
            <h3>{t("notes")}</h3>
            <p dir="auto">
              <LinkedText text={project.description} />
            </p>
          </section>
        )}
        {checklistItems(project.checklist).map((item) => (
          <label key={item.index} className="st-checkbox">
            <input
              type="checkbox"
              checked={item.done}
              disabled={scope.role === "member"}
              onChange={() =>
                void run({
                  kind: "actions",
                  actions: [
                    {
                      target: "projects",
                      action: "update",
                      scope: scope.id,
                      id: project.id,
                      values: {
                        checklist: toggleChecklist(
                          project.checklist || "",
                          item.index,
                        ),
                      },
                    },
                  ],
                })
              }
            />
            <span dir="auto">{item.text}</span>
          </label>
        ))}
        <div className="st-links">
          {[project.projectUrl, project.attachmentUrl, ...(project.links || [])]
            .filter((url): url is string => !!url)
            .map((url, index) => (
              <ExternalLink url={url} key={index}>
                <span dir="auto">{new URL(url).hostname}</span>
              </ExternalLink>
            ))}
        </div>
        <footer className="st-dialog-actions">
          <button
            className="st-primary"
            onClick={() => {
              navigateStudio({ item: "" });
              focus(project.id, project.name);
            }}
          >
            <Play size={16} />
            {t("startFocus")}
          </button>
          <button
            className="st-secondary"
            disabled={scope.role === "member"}
            onClick={() => {
              navigateStudio({ item: "" });
              edit({ kind: "project", scope: scope.id, value: project });
            }}
          >
            <Pencil size={16} />
            {t("edit")}
          </button>
          <button
            className="st-quiet"
            onClick={() => {
              navigateStudio({ item: "" });
              ask(t("explain") + " — " + project.name);
            }}
          >
            <Sparkles size={16} />
            {t("assistant")}
          </button>
        </footer>
      </div>
    </StudioDialog>
  );
}
