import { useState } from "react";
import {
  BookOpen,
  Search,
  FileCheck2,
  Layers,
  CalendarClock,
  Plus,
} from "lucide-react";
import { searchStudio } from "../core/selectors";
import { useStudio } from "./context";
import { navigateStudio } from "./navigation";
import { StudioDialog } from "./primitives";
export default function SearchPalette({ close }: { close: () => void }) {
  const { state, t, edit } = useStudio(),
    [query, setQuery] = useState("");
  const results = searchStudio(state, query),
    icons = {
      project: Layers,
      course: BookOpen,
      task: FileCheck2,
      lesson: CalendarClock,
    };
  return (
    <StudioDialog title={t("search")} close={close} wide>
      <label className="st-palette-input">
        <Search size={21} />
        <span className="st-sr-only">{t("searchHint")}</span>
        <input
          autoFocus
          value={query}
          placeholder={t("searchHint")}
          onChange={(event) => setQuery(event.target.value)}
        />
        <kbd>Esc</kbd>
      </label>
      <div className="st-palette-results">
        {!query ? (
          <div className="st-quick-commands">
            {(["project", "course", "task"] as const).map((kind) => (
              <button
                key={kind}
                onClick={() => {
                  close();
                  edit(
                    kind === "project" ? { kind, scope: "personal" } : { kind },
                  );
                }}
              >
                <Plus size={18} />
                {t(
                  kind === "project"
                    ? "newCard"
                    : kind === "course"
                      ? "newCourse"
                      : "newTask",
                )}
              </button>
            ))}
          </div>
        ) : results.length ? (
          results.map((result) => {
            const Icon = icons[result.kind];
            return (
              <button
                key={result.key}
                onClick={() => {
                  navigateStudio(
                    result.kind === "project"
                      ? {
                          screen:
                            result.scope === "personal" ? "projects" : "groups",
                          scope: result.scope,
                          item: result.id,
                        }
                      : {
                          screen: "university",
                          course: result.courseId || "",
                          tab:
                            result.kind === "task"
                              ? "tasks"
                              : result.kind === "lesson"
                                ? "schedule"
                                : "overview",
                          item: result.kind === "task" ? result.id : "",
                        },
                  );
                  close();
                }}
              >
                <Icon size={20} />
                <span>
                  <strong dir="auto">{result.title}</strong>
                  <small dir="auto">{result.detail}</small>
                </span>
              </button>
            );
          })
        ) : (
          <p>{t("noResults")}</p>
        )}
      </div>
    </StudioDialog>
  );
}
