import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  GraduationCap,
  ListChecks,
  NotebookPen,
  Pencil,
  Plus,
  Bell,
  Archive,
  Trash2,
} from "lucide-react";
import CourseNavigator from "../../university/CourseNavigator";
import Timetable from "../../university/Timetable";
import LinkedText from "../../components/LinkedText";
import { lessonConflicts } from "../../university/planImport";
import type { StudyTask } from "../../university/state";
import { courseColorIndex } from "../core/selectors";
import { usePreview, go } from "./context";
import Disclosure from "./Disclosure";
import { days } from "./words";
const colors = [
  "#385c4b",
  "#aa4c2a",
  "#4c6d91",
  "#8d6588",
  "#8a7236",
  "#377e83",
];
const color = (id: string) => colors[courseColorIndex(id)];
function dateLabel(value: string, language: string) {
  return value
    ? new Intl.DateTimeFormat(
        language === "ar" ? "ar" : language === "he" ? "he" : "en",
        {
          dateStyle: "medium",
          ...(value.includes("T") ? { timeStyle: "short" as const } : {}),
        },
      ).format(new Date(value))
    : "";
}
export default function University() {
  const { state, route, t, edit, run, act, now, busy } = usePreview(),
    [week, setWeek] = useState(false),
    [day, setDay] = useState(new Date().getDay());
  const courses = state.data.study.courses.filter((c) => {
    const term = state.semesters.find(
      (s) => s.id === state.courseSemesters[c.id],
    );
    return (
      route.term === "all" ||
      (route.term === "current" && !term?.archived) ||
      term?.id === route.term
    );
  });
  const selected = courses.find((c) => c.id === route.course),
    tasks = state.data.study.tasks.filter(
      (task) =>
        courses.some((c) => c.id === task.courseId) &&
        (!selected || task.courseId === selected.id),
    );
  const pending = tasks.filter((task) => !task.done),
    overdue = pending.filter(
      (task) => !!task.due && Date.parse(task.due) < now,
    ),
    next = pending
      .filter((task) => task.due && Date.parse(task.due) >= now)
      .sort((a, b) => a.due.localeCompare(b.due))[0];
  const lessons = state.data.study.lessons.filter(
    (lesson) =>
      courses.some((c) => c.id === lesson.courseId) &&
      (!selected || lesson.courseId === selected.id),
  );
  const upcoming = lessons
    .map((lesson) => {
      const date = new Date(now);
      date.setDate(date.getDate() + ((lesson.day - date.getDay() + 7) % 7));
      date.setHours(
        Number(lesson.start.slice(0, 2)),
        Number(lesson.start.slice(3)),
        0,
        0,
      );
      if (date.getTime() < now) date.setDate(date.getDate() + 7);
      return { lesson, date };
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  const courseName = (id: string) =>
    state.data.study.courses.find((c) => c.id === id)?.name || "";
  const tabs = [
    ["overview", BookOpen],
    ["tasks", ListChecks],
    ["materials", NotebookPen],
    ["plan", GraduationCap],
    ["schedule", CalendarDays],
  ] as const;
  const activeTerm = state.semesters.find((s) => s.id === route.term);
  return (
    <section className="study-page preview-university">
      <header className="preview-page-title">
        <div>
          <h2>
            <GraduationCap size={25} />
            {t("university")}
          </h2>
          <p>{selected?.name || t("overview")}</p>
        </div>
        <Disclosure
          className="preview-add-menu"
          title={
            <>
              <Plus size={17} />
              {t("add")}
            </>
          }
        >
          <div className="preview-menu-items">
            <button onClick={() => edit({ kind: "course" })}>
              <BookOpen size={17} />
              {t("newCourse")}
            </button>
            <button
              disabled={!courses.length}
              onClick={() => edit({ kind: "task" })}
            >
              <ListChecks size={17} />
              {t("newTask")}
            </button>
            <button
              disabled={!courses.length}
              onClick={() => edit({ kind: "lesson" })}
            >
              <CalendarDays size={17} />
              {t("newLesson")}
            </button>
            <button onClick={() => edit({ kind: "semester" })}>
              <GraduationCap size={17} />
              {t("semester")}
            </button>
          </div>
        </Disclosure>
      </header>
      <div className="preview-summary">
        <button onClick={() => go({ tab: "tasks", filter: "open" })}>
          <ListChecks size={17} />
          <strong>{pending.length}</strong>
          {t("open")}
        </button>
        <button
          className={overdue.length ? "preview-overdue" : ""}
          onClick={() => go({ tab: "tasks", filter: "overdue" })}
        >
          <Clock size={17} />
          <strong>{overdue.length}</strong>
          {t("overdue")}
        </button>
        <span>
          <BookOpen size={17} />
          <strong>{courses.length}</strong>
          {t("course")}
        </span>
      </div>
      <div className="preview-semester">
        <label>
          {t("semester")}
          <select
            disabled={busy}
            aria-label={t("semester")}
            value={route.term}
            onChange={(e) =>
              go({ term: e.target.value, course: "", tab: "overview" })
            }
          >
            <option value="current">{t("active")}</option>
            <option value="all">{t("all")}</option>
            {state.semesters.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name}
                {term.archived ? " · " + t("archived") : ""}
              </option>
            ))}
          </select>
        </label>
        {activeTerm && (
          <button
            className="text-button"
            onClick={() =>
              void run({
                kind: "semester",
                value: { ...activeTerm, archived: !activeTerm.archived },
              })
            }
          >
            <Archive size={16} />
            {activeTerm.archived ? t("restore") : t("archive")}
          </button>
        )}
      </div>
      <div className="study-layout preview-study-layout">
        <CourseNavigator
          key={route.course + "/" + route.term}
          courses={courses}
          tasks={state.data.study.tasks}
          selectedId={selected?.id || ""}
          filter={selected?.id || ""}
          onSelect={(id) => go({ course: id, tab: "overview", filter: "all" })}
          courseColor={color}
          onAdd={() => edit({ kind: "course" })}
        />
        <section className="study-task-list preview-course-panel">
          <header
            className="preview-course-heading"
            style={
              selected
                ? { borderInlineStartColor: color(selected.id) }
                : undefined
            }
          >
            <div>
              <span className="preview-muted">
                {selected ? t("selected") : t("all")}
              </span>
              <h3 dir="auto">{selected?.name || t("university")}</h3>
            </div>
            {selected && (
              <button
                className="text-button"
                onClick={() => edit({ kind: "course", value: selected })}
              >
                <Pencil size={16} />
                {t("edit")}
              </button>
            )}
          </header>
          <nav className="study-tabs preview-tabs" aria-label={t("course")}>
            {tabs.map(([tab, Icon]) => (
              <button
                key={tab}
                className="secondary-button"
                aria-pressed={route.tab === tab}
                onClick={() => go({ tab, filter: "all" })}
              >
                <Icon size={17} />
                {t(tab)}
              </button>
            ))}
          </nav>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={route.tab + "/" + (selected?.id || "all")}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.16 }}
            >
              {route.tab === "overview" && (
                <>
                  <div className="preview-next-grid">
                    <section>
                      <span>
                        <CalendarDays size={17} />
                        {t("nextClass")}
                      </span>
                      {upcoming ? (
                        <>
                          <strong dir="auto">
                            {courseName(upcoming.lesson.courseId)}
                          </strong>
                          <time>
                            {days[state.settings.language][upcoming.lesson.day]}{" "}
                            · {upcoming.lesson.start} — {upcoming.lesson.end}
                          </time>
                          <small>{upcoming.lesson.room}</small>
                        </>
                      ) : (
                        <p>{t("empty")}</p>
                      )}
                    </section>
                    <section>
                      <span>
                        <Clock size={17} />
                        {t("nextDue")}
                      </span>
                      {next ? (
                        <>
                          <strong dir="auto">{next.title}</strong>
                          <small dir="auto">{courseName(next.courseId)}</small>
                          <time>
                            {dateLabel(next.due, state.settings.language)}
                          </time>
                        </>
                      ) : (
                        <p>{t("empty")}</p>
                      )}
                    </section>
                  </div>
                  {selected?.notes && (
                    <section className="study-course-notes">
                      <h4>
                        <NotebookPen size={16} />
                        {t("notes")}
                      </h4>
                      <p dir="auto">
                        <LinkedText text={selected.notes} />
                      </p>
                    </section>
                  )}
                  <TaskList
                    tasks={[...pending]
                      .sort((a, b) =>
                        (a.due || "9999").localeCompare(b.due || "9999"),
                      )
                      .slice(0, 4)}
                  />
                </>
              )}
              {route.tab === "tasks" && <TaskList tasks={tasks} filters />}
              {route.tab === "materials" &&
                (selected ? (
                  <section className="preview-materials">
                    <h4>{t("notes")}</h4>
                    {selected.notes ? (
                      <p dir="auto">
                        <LinkedText text={selected.notes} />
                      </p>
                    ) : (
                      <p>{t("empty")}</p>
                    )}
                    {selected.url && (
                      <a
                        className="preview-resource-link"
                        href={selected.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={16} />
                        {t("course")}
                      </a>
                    )}
                    {selected.source && (
                      <>
                        <p>{selected.source.teachers.join(" · ")}</p>
                        <p dir="auto">
                          <LinkedText text={selected.source.description} />
                        </p>
                        {selected.source.sections.map((section) => (
                          <Disclosure key={section.id} title={section.title}>
                            <p dir="auto">
                              <LinkedText text={section.description} />
                            </p>
                            <MaterialItems items={section.activities} />
                          </Disclosure>
                        ))}
                      </>
                    )}
                  </section>
                ) : (
                  <CourseChoice />
                ))}
              {route.tab === "plan" &&
                (selected ? (
                  <section>
                    <h4>{t("plan")}</h4>
                    <progress
                      value={
                        selected.topics?.filter((topic) => topic.done).length ||
                        0
                      }
                      max={selected.topics?.length || 1}
                      aria-label={t("plan")}
                    />
                    <ul className="study-topic-list">
                      {selected.topics?.map((topic) => (
                        <motion.li layout key={topic.id}>
                          <label
                            className={
                              "preview-check " + (topic.done ? "is-done" : "")
                            }
                          >
                            <input
                              type="checkbox"
                              checked={topic.done}
                              onChange={() =>
                                void act([
                                  {
                                    target: "courses",
                                    action: "update",
                                    id: selected.id,
                                    values: {
                                      topics: selected.topics?.map((item) =>
                                        item.id === topic.id
                                          ? { ...item, done: !item.done }
                                          : item,
                                      ),
                                    },
                                  },
                                ])
                              }
                            />
                            <span>{topic.title}</span>
                            {topic.done && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                              >
                                <Check size={16} />
                              </motion.span>
                            )}
                          </label>
                        </motion.li>
                      ))}
                    </ul>
                    {!selected.topics?.length && (
                      <button
                        className="secondary-button"
                        onClick={() =>
                          edit({ kind: "course", value: selected })
                        }
                      >
                        <Plus size={16} />
                        {t("plan")}
                      </button>
                    )}
                    <Disclosure
                      title={
                        state.settings.language === "ar"
                          ? "المتطلبات السابقة"
                          : "Prerequisites"
                      }
                    >
                      {selected.requires.map((id) => (
                        <button
                          className="text-button"
                          key={id}
                          onClick={() => go({ course: id, tab: "overview" })}
                        >
                          {courseName(id)}
                        </button>
                      ))}
                    </Disclosure>
                  </section>
                ) : (
                  <CourseChoice />
                ))}
              {route.tab === "schedule" && (
                <section>
                  <div className="preview-actions">
                    <button
                      className="secondary-button"
                      aria-pressed={!week}
                      onClick={() => setWeek(false)}
                    >
                      {t("agenda")}
                    </button>
                    <button
                      className="secondary-button"
                      aria-pressed={week}
                      onClick={() => setWeek(true)}
                    >
                      {t("week")}
                    </button>
                    <button
                      className="text-button"
                      disabled={!courses.length}
                      onClick={() => edit({ kind: "lesson" })}
                    >
                      <Plus size={16} />
                      {t("newLesson")}
                    </button>
                  </div>
                  {week ? (
                    <Timetable
                      lessons={lessons}
                      courses={courses}
                      courseFilter={selected?.id || ""}
                      conflicts={lessonConflicts(lessons)}
                      language={state.settings.language}
                      courseColor={color}
                      onEdit={(lesson) =>
                        edit({ kind: "lesson", value: lesson })
                      }
                    />
                  ) : (
                    <>
                      <label className="preview-day">
                        {t("day")}
                        <select
                          value={day}
                          onChange={(e) => setDay(Number(e.target.value))}
                        >
                          {days[state.settings.language].map((label, i) => (
                            <option key={label} value={i}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      {lessons
                        .filter((lesson) => lesson.day === day)
                        .sort((a, b) => a.start.localeCompare(b.start))
                        .map((lesson) => (
                          <motion.article
                            layout
                            className={
                              "preview-agenda-item " +
                              (lessonConflicts(lessons).has(lesson.id)
                                ? "preview-conflict"
                                : "")
                            }
                            key={lesson.id}
                            style={{
                              borderInlineStartColor: color(lesson.courseId),
                            }}
                          >
                            <time dir="ltr">
                              {lesson.start} — {lesson.end}
                            </time>
                            <div>
                              <strong dir="auto">
                                {courseName(lesson.courseId)}
                              </strong>
                              <small>{lesson.room}</small>
                              {lessonConflicts(lessons).has(lesson.id) && (
                                <small className="preview-overdue">
                                  {t("timeConflict")}
                                </small>
                              )}
                              {lesson.notes && (
                                <p dir="auto">
                                  <LinkedText text={lesson.notes} />
                                </p>
                              )}
                            </div>
                            <button
                              className="preview-icon"
                              aria-label={
                                t("edit") + " " + courseName(lesson.courseId)
                              }
                              onClick={() =>
                                edit({ kind: "lesson", value: lesson })
                              }
                            >
                              <Pencil size={17} />
                            </button>
                          </motion.article>
                        ))}
                      {!lessons.some((lesson) => lesson.day === day) && (
                        <p className="study-empty">{t("empty")}</p>
                      )}
                    </>
                  )}
                </section>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </section>
  );
}
function CourseChoice() {
  const { t } = usePreview();
  return <p className="study-empty">{t("course")} ←</p>;
}
function MaterialItems({
  items,
}: {
  items: NonNullable<
    import("../../university/state").Course["source"]
  >["sections"][number]["activities"];
}) {
  const [page, setPage] = useState(0),
    { t } = usePreview();
  return (
    <>
      <ul className="preview-material-list">
        {items.slice(page * 20, page * 20 + 20).map((item) => (
          <li key={item.id}>
            {item.url ? (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                dir="auto"
              >
                <ExternalLink size={15} />
                {item.title}
              </a>
            ) : (
              <strong dir="auto">{item.title}</strong>
            )}
            {item.description && (
              <p dir="auto">
                <LinkedText text={item.description} />
              </p>
            )}
          </li>
        ))}
      </ul>
      {items.length > 20 && (
        <div className="preview-actions">
          <button disabled={!page} onClick={() => setPage(page - 1)}>
            {t("previous")}
          </button>
          <span>
            {page + 1}/{Math.ceil(items.length / 20)}
          </span>
          <button
            disabled={(page + 1) * 20 >= items.length}
            onClick={() => setPage(page + 1)}
          >
            {t("next")}
          </button>
        </div>
      )}
    </>
  );
}
function TaskList({
  tasks,
  filters = false,
}: {
  tasks: StudyTask[];
  filters?: boolean;
}) {
  const { state, route, now, t, edit, act, run, notify, busy } = usePreview(),
    [requestedPage, setPage] = useState(0);
  const filtered = tasks
    .filter(
      (task) =>
        !filters ||
        route.filter === "all" ||
        (route.filter === "open" && !task.done) ||
        (route.filter === "done" && task.done) ||
        (route.filter === "overdue" &&
          !task.done &&
          !!task.due &&
          Date.parse(task.due) < now),
    )
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (a.due || "9999").localeCompare(b.due || "9999"),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 20)),
    page = Math.min(requestedPage, pages - 1);
  return (
    <section className="preview-tasks">
      <header className="preview-section-heading">
        <h4>
          <ListChecks size={17} />
          {t("tasks")}
        </h4>
        <button
          className="text-button"
          disabled={!state.data.study.courses.length}
          onClick={() => edit({ kind: "task" })}
        >
          <Plus size={16} />
          {t("newTask")}
        </button>
      </header>
      {filters && (
        <label className="preview-filter">
          {t("filters")}
          <select
            value={route.filter}
            onChange={(e) => {
              setPage(0);
              go({ filter: e.target.value });
            }}
          >
            {(["all", "open", "overdue", "done"] as const).map((value) => (
              <option value={value} key={value}>
                {t(value)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="preview-task-stack">
        <AnimatePresence initial={false}>
          {filtered.slice(page * 20, page * 20 + 20).map((task) => (
            <motion.article
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              key={task.id}
              className={"preview-task " + (task.done ? "is-done" : "")}
              data-preview-task={task.id}
            >
              <label className="preview-task-toggle">
                <input
                  type="checkbox"
                  disabled={busy}
                  checked={task.done}
                  aria-label={t("complete") + " " + task.title}
                  onChange={() =>
                    void act([
                      {
                        target: "tasks",
                        action: "update",
                        id: task.id,
                        values: { done: !task.done },
                      },
                    ])
                  }
                />
                <Check size={16} aria-hidden="true" />
              </label>
              <div className="preview-task-body">
                <small dir="auto" style={{ color: color(task.courseId) }}>
                  {
                    state.data.study.courses.find(
                      (course) => course.id === task.courseId,
                    )?.name
                  }{" "}
                  · {t(task.kind)}
                </small>
                <strong dir="auto">{task.title}</strong>
                {task.due && (
                  <time
                    className={
                      !task.done && Date.parse(task.due) < now
                        ? "preview-overdue"
                        : ""
                    }
                  >
                    {dateLabel(task.due, state.settings.language)}
                  </time>
                )}
                {task.notes && (
                  <p dir="auto">
                    <LinkedText text={task.notes} />
                  </p>
                )}
                {task.url && (
                  <a href={task.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={14} />
                    {t("url")}
                  </a>
                )}
              </div>
              <div className="preview-task-tools">
                <button
                  className="preview-icon"
                  aria-label={t("edit") + " " + task.title}
                  onClick={() => edit({ kind: "task", value: task })}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="preview-icon preview-bell"
                  aria-pressed={state.reminders.includes(task.id)}
                  aria-label={t("reminder") + " " + task.title}
                  onClick={() => {
                    if (!task.due || task.done) notify(t("dateNeeded"));
                    else
                      void run({ kind: "reminder", taskId: task.id }).then(
                        (ok) => {
                          if (ok) notify(t("reminderHint"));
                        },
                      );
                  }}
                >
                  <Bell size={16} />
                </button>
                <button
                  className="preview-icon preview-danger"
                  aria-label={t("remove") + " " + task.title}
                  onClick={() =>
                    void act([
                      { target: "tasks", action: "delete", id: task.id },
                    ])
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
      {!filtered.length && <p className="study-empty">{t("empty")}</p>}
      {pages > 1 && (
        <nav className="preview-pagination" aria-label={t("tasks")}>
          <button
            className="secondary-button"
            disabled={!page}
            onClick={() => setPage(page - 1)}
          >
            <ChevronRight size={16} />
            {t("previous")}
          </button>
          <span>
            {page + 1}/{pages}
          </span>
          <button
            className="secondary-button"
            disabled={page + 1 === pages}
            onClick={() => setPage(page + 1)}
          >
            {t("next")}
            <ChevronLeft size={16} />
          </button>
        </nav>
      )}
    </section>
  );
}
