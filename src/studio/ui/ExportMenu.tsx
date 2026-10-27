import { Download } from "lucide-react";
import { downloadAssistantFile } from "../../assistant/pdfExport";
import { downloadStudioFile } from "../adapters/download";
import { studioCalendar, studioCsv } from "../core/calendar";
import { useStudio } from "./context";
export function StudioExportMenu() {
  const { state, t, now, route, notify } = useStudio();
  async function pdf() {
    try {
      const courses = state.data.study.courses.filter(
        (c) => !route.course || c.id === route.course,
      );
      const scopes = state.data.scopes.filter((scope) =>
        route.screen === "projects"
          ? scope.id === "personal"
          : route.screen === "groups"
            ? scope.id === route.scope
            : true,
      );
      const lines = [
        t(route.screen),
        new Date(now).toLocaleDateString(state.settings.language),
        ...(route.screen === "university"
          ? []
          : scopes.flatMap((scope) => [
              scope.name,
              ...scope.projects
                .filter((project) => !project.trashedAt && !project.archivedAt)
                .flatMap((project) => [
                  project.name,
                  t("nextStep") + ": " + project.nextStep,
                  project.dueDate || "",
                  project.description || "",
                ]),
            ])),
        ...(["university", "today"].includes(route.screen)
          ? courses.flatMap((course) => [
              course.name,
              course.notes,
              ...state.data.study.tasks
                .filter((task) => task.courseId === course.id)
                .map((task) => task.title + " — " + task.due),
            ])
          : []),
      ];
      if (lines.join("\n\n").length > 30000) {
        notify(t("pdfTooLarge"));
        return;
      }
      await downloadAssistantFile(
        { name: "wilo-preview.pdf", content: lines.join("\n\n") },
        state.settings.language,
      );
    } catch {
      notify(t("failed"));
    }
  }
  return (
    <details className="st-export-menu">
      <summary>
        <Download size={16} />
        {t("export")}
      </summary>
      <div>
        <button
          onClick={() =>
            downloadStudioFile(
              "wilo-preview.ics",
              studioCalendar(state, now, route.course),
              "text/calendar;charset=utf-8",
            )
          }
        >
          {t("calendar")}
        </button>
        <button
          onClick={() =>
            downloadStudioFile(
              "wilo-preview.csv",
              "\uFEFF" + studioCsv(state),
              "text/csv;charset=utf-8",
            )
          }
        >
          {t("csv")}
        </button>
        <button
          onClick={() =>
            downloadStudioFile(
              "wilo-preview.json",
              JSON.stringify({ format: "wilo-studio-v1", state }, null, 2),
              "application/json",
            )
          }
        >
          {t("backup")}
        </button>
        <button onClick={() => void pdf()}>{t("pdf")}</button>
      </div>
    </details>
  );
}
