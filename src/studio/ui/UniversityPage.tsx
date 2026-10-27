import {
  Plus,
  Search,
  CalendarDays,
  GraduationCap,
  Archive,
  ArrowUpRight,
} from "lucide-react";
import {
  courseColorIndex,
  normalizeSearch,
  studioAgenda,
} from "../core/selectors";
import { useStudio } from "./context";
import { navigateStudio, useStudioSearch } from "./navigation";
import { EmptyState } from "./primitives";
import CoursePanel from "./CoursePanel";
import StudySchedule from "./StudySchedule";
import StudyTasks from "./StudyTasks";
export default function StudioUniversity() {
  const { state, route, t, edit, run, now } = useStudio(),
    [search, setSearch] = useStudioSearch(),
    agenda = studioAgenda(state, now);
  const selected = state.data.study.courses.find((c) => c.id === route.course);
  const currentTerm = state.semesters.find((term) => term.id === route.term);
  const courses = state.data.study.courses
    .filter((c) => {
      const term = state.semesters.find(
        (s) => s.id === state.courseSemesters[c.id],
      );
      return (
        (route.term === "all" ||
          (route.term === "current" && !term?.archived) ||
          (route.term === "archived" && term?.archived) ||
          term?.id === route.term) &&
        normalizeSearch(c.name).includes(normalizeSearch(search))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return (
    <section className="st-university">
      <header className="st-section-header">
        <div>
          <span className="st-eyebrow">WILO / {t("university")}</span>
          <h1>{t("university")}</h1>
          <p>{t("courseIntro")}</p>
        </div>
        <div className="st-course-tools">
          <button
            className="st-secondary"
            onClick={() =>
              navigateStudio({
                tab: route.tab === "schedule" ? "overview" : "schedule",
                item: "",
              })
            }
          >
            <CalendarDays size={17} />
            {t("schedule")}
          </button>
          <button
            className="st-primary"
            onClick={() => edit({ kind: "course" })}
          >
            <Plus size={17} />
            {t("newCourse")}
          </button>
        </div>
      </header>
      <div className="st-study-layout">
        <aside className="st-course-nav">
          <header>
            <h2>{t("myCourses")}</h2>
            <span className="st-count">{courses.length}</span>
          </header>
          <label className="st-search-field">
            <Search size={17} />
            <span className="st-sr-only">{t("courseSearch")}</span>
            <input
              placeholder={t("courseSearch")}
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </label>
          <label className="st-inline-label">
            {t("semester")}
            <select
              aria-label={t("semester")}
              value={route.term}
              onChange={(event) =>
                navigateStudio({
                  term: event.target.value,
                  course: "",
                  tab: "overview",
                  item: "",
                })
              }
            >
              <option value="current">{t("activeSemesters")}</option>
              <option value="all">{t("all")}</option>
              {state.semesters.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                  {term.archived ? " · " + t("archive") : ""}
                </option>
              ))}
              <option value="archived">{t("archivedTerms")}</option>
            </select>
          </label>
          <button
            className="st-all-courses"
            aria-pressed={!selected}
            onClick={() =>
              navigateStudio({ course: "", tab: "overview", item: "" })
            }
          >
            {t("overview")}
          </button>
          <div className="st-course-nav-list">
            {courses.map((c) => (
              <button
                className={
                  "st-course-nav-item st-color-" + courseColorIndex(c.id)
                }
                key={c.id}
                aria-pressed={c.id === selected?.id}
                onClick={() =>
                  navigateStudio({ course: c.id, tab: "overview", item: "" })
                }
              >
                <span className="st-course-dot" />
                <span>
                  <strong dir="auto">{c.name}</strong>
                  <small>
                    {
                      state.data.study.tasks.filter(
                        (task) => task.courseId === c.id && !task.done,
                      ).length
                    }{" "}
                    {t("tasks")}
                  </small>
                </span>
                {c.id === selected?.id && (
                  <span
                    className="st-course-selected"
                    aria-label={t("currentCourse")}
                  />
                )}
              </button>
            ))}
            {!courses.length && <p className="st-muted">{t("noResults")}</p>}
          </div>
          <footer>
            <button
              className="st-link-button"
              onClick={() => edit({ kind: "semester" })}
            >
              <Plus size={15} />
              {t("newSemester")}
            </button>
            {currentTerm && (
              <button
                className="st-link-button"
                onClick={() =>
                  void run({
                    kind: "semester",
                    value: { ...currentTerm, archived: !currentTerm.archived },
                  })
                }
              >
                <Archive size={15} />
                {currentTerm.archived ? t("restore") : t("archiveTerm")}
              </button>
            )}
          </footer>
        </aside>
        <div className="st-study-content">
          {route.tab === "schedule" ? (
            <StudySchedule />
          ) : selected ? (
            <CoursePanel key={selected.id} course={selected} />
          ) : (
            <>
              <div className="st-study-welcome">
                <div>
                  <GraduationCap size={30} />
                  <h2>
                    {t("today")} / {t("university")}
                  </h2>
                </div>
                <p>{t("todayIntro")}</p>
              </div>
              <div className="st-university-summary">
                <button
                  className="st-surface st-summary-urgent"
                  onClick={() =>
                    navigateStudio({
                      course: "",
                      filter: "overdue",
                      tab: "tasks",
                    })
                  }
                >
                  <strong>{agenda.overdue.length}</strong>
                  <span>{t("overdue")}</span>
                </button>
                <button
                  className="st-surface"
                  onClick={() => navigateStudio({ tab: "schedule" })}
                >
                  <strong>{agenda.lessons.length}</strong>
                  <span>{t("nextClass")}</span>
                </button>
                <button
                  className="st-surface"
                  onClick={() =>
                    navigateStudio({ tab: "tasks", filter: "upcoming" })
                  }
                >
                  <strong>{agenda.upcoming.length}</strong>
                  <span>{t("upcoming")}</span>
                </button>
              </div>
              <div className="st-course-overview-grid">
                {courses.map((course) => {
                  const topics = course.topics || [],
                    done = topics.filter((topic) => topic.done).length;
                  return (
                    <button
                      className={
                        "st-course-tile st-color-" + courseColorIndex(course.id)
                      }
                      key={course.id}
                      onClick={() =>
                        navigateStudio({ course: course.id, tab: "overview" })
                      }
                    >
                      <span className="st-course-tile-top">
                        <GraduationCap size={22} />
                        <ArrowUpRight size={17} />
                      </span>
                      <h3 dir="auto">{course.name}</h3>
                      <div className="st-progress">
                        <progress
                          max={Math.max(1, topics.length)}
                          value={done}
                          aria-label={t("progress")}
                        />
                        <small>
                          {done}/{topics.length}
                        </small>
                      </div>
                      <span>
                        {
                          state.data.study.tasks.filter(
                            (task) => !task.done && task.courseId === course.id,
                          ).length
                        }{" "}
                        {t("tasks")}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!courses.length ? (
                <EmptyState
                  action={
                    <button
                      className="st-primary"
                      onClick={() => edit({ kind: "course" })}
                    >
                      {t("newCourse")}
                    </button>
                  }
                />
              ) : (
                <StudyTasks
                  tasks={[...agenda.overdue, ...agenda.upcoming]
                    .filter((task) =>
                      courses.some((c) => c.id === task.courseId),
                    )
                    .slice(0, route.tab === "tasks" ? 100 : 4)}
                />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
