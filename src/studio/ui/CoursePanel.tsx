import {
  BookOpen,
  Check,
  ExternalLink as LinkIcon,
  Pencil,
  Play,
  Sparkles,
} from "lucide-react";
import LinkedText from "../../components/LinkedText";
import { splitTextLinks } from "../../lib/textLinks";
import type { Course } from "../../university/state";
import { courseColorIndex } from "../core/selectors";
import { useStudio } from "./context";
import { navigateStudio } from "./navigation";
import { AsyncCheckbox, EmptyState, ExternalLink } from "./primitives";
import StudyTasks from "./StudyTasks";
const tabs = ["overview", "tasks", "materials", "plan", "map"] as const;
export default function CoursePanel({ course }: { course: Course }) {
  const { state, route, t, edit, run, ask, focus } = useStudio(),
    tab = tabs.includes(route.tab as (typeof tabs)[number])
      ? route.tab
      : "overview";
  const tasks = state.data.study.tasks.filter(
      (task) => task.courseId === course.id,
    ),
    topics = course.topics || [],
    done = topics.filter((topic) => topic.done).length,
    next = topics.find((topic) => !topic.done);
  const notesLinks = splitTextLinks(course.notes)
    .filter((part) => part.href)
    .map((part) => part.href!);
  const links = [
    ...new Set(
      [
        course.url,
        ...notesLinks,
        ...(course.source?.sections.flatMap((s) =>
          s.activities.map((a) => a.url),
        ) || []),
      ].filter(Boolean),
    ),
  ];
  const patch = (values: Record<string, unknown>) =>
    run({
      kind: "actions",
      actions: [{ target: "courses", action: "update", id: course.id, values }],
    });
  return (
    <div
      className={"st-course-panel st-color-" + courseColorIndex(course.id)}
      data-studio-course={course.id}
    >
      <header className="st-course-heading">
        <div>
          <span className="st-eyebrow">{t("currentCourse")}</span>
          <h2 dir="auto">{course.name}</h2>
          <label className="st-inline-label">
            {t("semester")}
            <select
              aria-label={t("semester")}
              value={state.courseSemesters[course.id] || ""}
              onChange={(event) =>
                void run({
                  kind: "assign-semester",
                  courseId: course.id,
                  semesterId: event.target.value,
                })
              }
            >
              <option value="">{t("unassigned")}</option>
              {state.semesters.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                  {term.archived ? " · " + t("archive") : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="st-course-tools">
          <button
            className="st-icon-button"
            aria-label={t("edit") + " " + course.name}
            onClick={() => edit({ kind: "course", value: course })}
          >
            <Pencil size={17} />
          </button>
          {course.url && <ExternalLink url={course.url} />}
          <button
            className="st-primary"
            onClick={() => focus(course.id, course.name)}
          >
            <Play size={16} />
            {t("startFocus")}
          </button>
        </div>
      </header>
      <nav className="st-tab-row" aria-label={t("course")}>
        {tabs.map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => navigateStudio({ tab: value, item: "" })}
          >
            {t(value)}
          </button>
        ))}
      </nav>
      {tab === "overview" && (
        <>
          <div className="st-course-overview">
            <article className="st-surface">
              <BookOpen size={21} />
              <h3>{t("nextTopic")}</h3>
              <p dir="auto">{next?.title || t("done")}</p>
              <div className="st-progress">
                <progress
                  max={Math.max(1, topics.length)}
                  value={done}
                  aria-label={t("progress")}
                />
                <span>
                  {done} / {topics.length}
                </span>
              </div>
              <button
                className="st-link-button"
                onClick={() => navigateStudio({ tab: "plan" })}
              >
                {t("plan")}
              </button>
            </article>
            <article className="st-surface">
              <Sparkles size={21} />
              <h3>{t("assistant")}</h3>
              <p>{t("assistantHint")}</p>
              <button
                className="st-link-button"
                onClick={() => ask(t("planCourse") + " — " + course.name)}
              >
                {t("planCourse")}
              </button>
            </article>
          </div>
          <StudyTasks
            tasks={tasks.filter((task) => !task.done).slice(0, 3)}
            courseId={course.id}
          />
          {course.notes && (
            <section className="st-note-preview">
              <h3>{t("notes")}</h3>
              <p dir="auto">
                <LinkedText text={course.notes.slice(0, 600)} />
              </p>
              <button
                className="st-link-button"
                onClick={() => navigateStudio({ tab: "materials" })}
              >
                {t("showAll")}
              </button>
            </section>
          )}
        </>
      )}
      {tab === "tasks" && <StudyTasks tasks={tasks} courseId={course.id} />}
      {tab === "materials" && (
        <div className="st-materials">
          <header className="st-section-header">
            <h3>{t("notes")}</h3>
            <button
              className="st-secondary"
              onClick={() => edit({ kind: "course", value: course })}
            >
              <Pencil size={16} />
              {t("edit")}
            </button>
          </header>
          {course.notes ? (
            <p className="st-long-note" dir="auto">
              <LinkedText text={course.notes} />
            </p>
          ) : (
            <EmptyState />
          )}
          <h3>{t("links")}</h3>
          <div className="st-material-links">
            {links.map((url) => (
              <ExternalLink url={url} key={url}>
                <LinkIcon size={18} />
                <span dir="ltr">{new URL(url).hostname}</span>
              </ExternalLink>
            ))}
          </div>
          {course.source && (
            <section className="st-source-materials">
              <h3>{t("sources")}</h3>
              <p dir="auto">
                <LinkedText text={course.source.description} />
              </p>
              {course.source.sections.map((section) => (
                <details key={section.id}>
                  <summary dir="auto">{section.title}</summary>
                  <p dir="auto">
                    <LinkedText text={section.description} />
                  </p>
                  {section.activities.map((activity) => (
                    <article key={activity.id}>
                      {activity.url ? (
                        <ExternalLink url={activity.url}>
                          {activity.title}
                        </ExternalLink>
                      ) : (
                        <strong dir="auto">{activity.title}</strong>
                      )}
                      <p dir="auto">
                        <LinkedText text={activity.description} />
                      </p>
                    </article>
                  ))}
                </details>
              ))}
            </section>
          )}
        </div>
      )}
      {tab === "plan" && (
        <section className="st-plan">
          <header className="st-section-header">
            <h3>
              {t("plan")} · {done}/{topics.length}
            </h3>
            <button
              className="st-secondary"
              onClick={() => edit({ kind: "course", value: course })}
            >
              {t("edit")}
            </button>
          </header>
          <progress
            max={Math.max(1, topics.length)}
            value={done}
            aria-label={t("progress")}
          />
          {topics.length ? (
            topics.map((topic, index) => (
              <label
                className={"st-topic " + (topic.done ? "is-done" : "")}
                key={topic.id}
              >
                <AsyncCheckbox
                  checked={topic.done}
                  label={topic.title}
                  onChange={(value) =>
                    patch({
                      topics: topics.map((item) =>
                        item.id === topic.id ? { ...item, done: value } : item,
                      ),
                    })
                  }
                />
                <span className="st-topic-number">
                  {topic.done ? (
                    <Check size={15} />
                  ) : (
                    String(index + 1).padStart(2, "0")
                  )}
                </span>
                <span dir="auto">{topic.title}</span>
              </label>
            ))
          ) : (
            <EmptyState
              action={
                <button
                  className="st-primary"
                  onClick={() => edit({ kind: "course", value: course })}
                >
                  {t("plan")}
                </button>
              }
            />
          )}
        </section>
      )}
      {tab === "map" && (
        <section className="st-prerequisites">
          <h3>{t("requires")}</h3>
          {!course.requires.length ? (
            <EmptyState />
          ) : (
            course.requires.map((id) => {
              const required = state.data.study.courses.find(
                (c) => c.id === id,
              );
              return (
                <button
                  className={"st-prerequisite st-color-" + courseColorIndex(id)}
                  key={id}
                  onClick={() =>
                    navigateStudio({ course: id, tab: "overview" })
                  }
                >
                  <BookOpen size={20} />
                  <span dir="auto">{required?.name}</span>
                </button>
              );
            })
          )}
          <button
            className="st-secondary"
            onClick={() => edit({ kind: "course", value: course })}
          >
            {t("edit")}
          </button>
        </section>
      )}
    </div>
  );
}
