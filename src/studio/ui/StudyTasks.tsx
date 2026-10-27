import { useState } from "react";
import { Bell, Pencil, Plus, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import LinkedText from "../../components/LinkedText";
import type { StudyTask } from "../../university/state";
import { courseColorIndex } from "../core/selectors";
import { navigateStudio } from "./navigation";
import { useStudio } from "./context";
import { AsyncCheckbox, DueLabel, EmptyState } from "./primitives";
export default function StudyTasks({
  tasks,
  courseId,
}: {
  tasks: StudyTask[];
  courseId?: string;
}) {
  const { state, route, t, run, edit, notify } = useStudio();
  const [requestedPage, setPage] = useState(0);
  const sorted = [...tasks].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      (a.due || "9999").localeCompare(b.due || "9999"),
  );
  const selectedIndex = sorted.findIndex((task) => task.id === route.item);
  const pages = Math.max(1, Math.ceil(sorted.length / 24));
  const page = Math.min(
    pages - 1,
    selectedIndex >= 0 ? Math.floor(selectedIndex / 24) : requestedPage,
  );
  const changePage = (value: number) => {
    setPage(value);
    navigateStudio({ item: "" });
  };
  return (
    <section className="st-study-tasks">
      <header className="st-section-header">
        <h2>{t("tasks")}</h2>
        <button
          className="st-secondary"
          disabled={!state.data.study.courses.length}
          onClick={() => edit({ kind: "task", courseId })}
        >
          <Plus size={16} />
          {t("newTask")}
        </button>
      </header>
      {!tasks.length && <EmptyState />}
      <div className="st-task-stack">
        {sorted.slice(page * 24, (page + 1) * 24).map((task) => (
          <motion.article
            layout
            className={"st-study-task" + (task.done ? " is-done" : "")}
            key={task.id}
            data-studio-task={task.id}
          >
            <label className="st-task-check">
              <AsyncCheckbox
                checked={task.done}
                label={t("complete") + " " + task.title}
                onChange={(value) =>
                  run({
                    kind: "actions",
                    actions: [
                      {
                        target: "tasks",
                        action: "update",
                        id: task.id,
                        values: { done: value },
                      },
                    ],
                  })
                }
              />
              <span className="st-sr-only">
                {t("complete")} {task.title}
              </span>
            </label>
            <div className="st-task-body">
              <span className="st-card-type">
                <i
                  className={
                    "st-course-dot st-color-" + courseColorIndex(task.courseId)
                  }
                />
                <span dir="auto">
                  {
                    state.data.study.courses.find((c) => c.id === task.courseId)
                      ?.name
                  }
                </span>{" "}
                · {t(task.kind)}
              </span>
              <h3 dir="auto">{task.title}</h3>
              <DueLabel value={task.due} />
              {task.notes && (
                <p dir="auto">
                  <LinkedText text={task.notes} />
                </p>
              )}
            </div>
            <div className="st-task-tools">
              <button
                className="st-icon-button"
                aria-label={t("reminder") + " " + task.title}
                aria-pressed={state.reminders.includes(task.id)}
                onClick={() => {
                  if (!task.due || task.done) notify(t("reminderNeedsDate"));
                  else
                    void run({ kind: "reminder", taskId: task.id }).then(
                      (ok) => {
                        if (ok) notify(t("previewReminders"));
                      },
                    );
                }}
              >
                <Bell size={17} />
              </button>
              <button
                className="st-icon-button"
                aria-label={t("edit") + " " + task.title}
                onClick={() => edit({ kind: "task", value: task })}
              >
                <Pencil size={16} />
              </button>
              <button
                className="st-icon-button"
                aria-label={t("delete") + " " + task.title}
                onClick={() =>
                  void run({
                    kind: "actions",
                    actions: [
                      { target: "tasks", action: "delete", id: task.id },
                    ],
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          </motion.article>
        ))}
      </div>
      {pages > 1 && (
        <nav className="st-section-header" aria-label={t("tasks")}>
          <button
            className="st-secondary"
            disabled={page === 0}
            onClick={() => changePage(page - 1)}
          >
            {t("previousPage")}
          </button>
          <span>
            {page + 1} / {pages}
          </span>
          <button
            className="st-secondary"
            disabled={page + 1 === pages}
            onClick={() => changePage(page + 1)}
          >
            {t("nextPage")}
          </button>
        </nav>
      )}
    </section>
  );
}
