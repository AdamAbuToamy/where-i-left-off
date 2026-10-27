import {
  ArrowUpLeft,
  ArrowUpRight,
  CalendarClock,
  GraduationCap,
  CheckCheck,
  Clock3,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";
import { studioAgenda, courseColorIndex } from "../core/selectors";
import { useStudio } from "./context";
import { navigateStudio } from "./navigation";
import { DueLabel, EmptyState } from "./primitives";
export default function TodayPage() {
  const { state, now, t, edit, ask } = useStudio(),
    agenda = studioAgenda(state, now);
  const next = agenda.lessons[0],
    Arrow = state.settings.language === "en" ? ArrowUpRight : ArrowUpLeft;
  return (
    <div className="st-today">
      <section className="st-hero">
        <div>
          <span className="st-eyebrow">
            {new Intl.DateTimeFormat(state.settings.language, {
              weekday: "long",
              day: "numeric",
              month: "long",
            }).format(new Date(now))}
          </span>
          <h1>{t("greeting")}</h1>
          <p>{t("todayIntro")}</p>
          <div className="st-hero-actions">
            <button
              className="st-primary"
              onClick={() => edit({ kind: "project", scope: "personal" })}
            >
              {t("newCard")}
              <Arrow size={18} />
            </button>
            <button className="st-quiet" onClick={() => ask(t("summarize"))}>
              <Sparkles size={17} />
              {t("summarize")}
            </button>
          </div>
        </div>
        <div className="st-hero-art" aria-hidden="true">
          <span />
          <span />
          <span />
          <i>
            <CheckCheck size={42} />
          </i>
        </div>
      </section>
      <section className="st-today-grid">
        <article className="st-next-class st-surface">
          <header>
            <GraduationCap size={19} />
            <span>{t("nextClass")}</span>
          </header>
          {next ? (
            <>
              <span
                className={
                  "st-course-dot st-color-" + courseColorIndex(next.courseId)
                }
              />
              <h2 dir="auto">
                {
                  state.data.study.courses.find((c) => c.id === next.courseId)
                    ?.name
                }
              </h2>
              <p className="st-class-time" dir="ltr">
                {next.start} <span>—</span> {next.end}
              </p>
              <p>
                {t("room")} <b dir="auto">{next.room || "—"}</b>
              </p>
              <button
                className="st-link-button"
                onClick={() =>
                  navigateStudio({
                    screen: "university",
                    course: next.courseId,
                    tab: "overview",
                  })
                }
              >
                {t("openCourse")}
                <Arrow size={16} />
              </button>
            </>
          ) : (
            <EmptyState title={t("noClass")} />
          )}
        </article>
        <article className="st-surface st-deadlines">
          <header>
            <CalendarClock size={19} />
            <h2>{t("deadlines")}</h2>
            <span className="st-count">
              {agenda.overdue.length + agenda.upcoming.length}
            </span>
          </header>
          {[...agenda.overdue, ...agenda.upcoming].slice(0, 4).map((task) => (
            <button
              className="st-deadline-row"
              key={task.id}
              onClick={() =>
                navigateStudio({
                  screen: "university",
                  course: task.courseId,
                  tab: "tasks",
                  item: task.id,
                })
              }
            >
              <span
                className={
                  "st-course-dot st-color-" + courseColorIndex(task.courseId)
                }
              />
              <span>
                <strong dir="auto">{task.title}</strong>
                <small dir="auto">
                  {
                    state.data.study.courses.find((c) => c.id === task.courseId)
                      ?.name
                  }
                </small>
              </span>
              <DueLabel value={task.due} />
            </button>
          ))}
          {!agenda.overdue.length && !agenda.upcoming.length && <EmptyState />}
        </article>
      </section>
      <section className="st-section">
        <header className="st-section-header">
          <div>
            <span className="st-eyebrow">WILO / {t("today")}</span>
            <h2>{t("nextActions")}</h2>
          </div>
          <button
            className="st-link-button"
            onClick={() =>
              navigateStudio({
                screen: "projects",
                scope: "personal",
                item: "",
              })
            }
          >
            {t("showAll")}
            <Arrow size={16} />
          </button>
        </header>
        <div className="st-resume-grid">
          {agenda.projects.slice(0, 3).map(({ scope, project }, i) => (
            <motion.button
              layout
              className={"st-resume-card st-resume-" + i}
              key={scope.id + project.id}
              onClick={() =>
                navigateStudio({
                  screen: scope.id === "personal" ? "projects" : "groups",
                  scope: scope.id,
                  item: project.id,
                })
              }
            >
              <span className="st-resume-top">
                <span dir="auto">{scope.name}</span>
                <Arrow size={18} />
              </span>
              <h3 dir="auto">{project.name}</h3>
              <p dir="auto">{project.nextStep || t("nextStep")}</p>
              <span className="st-resume-bottom">
                <Clock3 size={15} />
                <DueLabel value={project.dueDate || ""} />
              </span>
            </motion.button>
          ))}
        </div>
        {!agenda.projects.length && (
          <EmptyState
            action={
              <button
                className="st-primary"
                onClick={() => edit({ kind: "project", scope: "personal" })}
              >
                {t("newCard")}
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}
