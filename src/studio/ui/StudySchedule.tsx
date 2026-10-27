import { useState } from "react";
import { CalendarDays, List, Plus, MapPin } from "lucide-react";
import {
  layoutTimetableDay,
  timetableBounds,
} from "../../university/timetableLayout";
import { lessonConflicts } from "../../university/planImport";
import { courseColorIndex } from "../core/selectors";
import { useStudio } from "./context";
import { navigateStudio } from "./navigation";
import { EmptyState } from "./primitives";
export default function StudySchedule() {
  const { state, route, now, t, edit } = useStudio(),
    [day, setDay] = useState(
      route.day ? Number(route.day) : new Date(now).getDay(),
    ),
    [mode, setMode] = useState(() =>
      route.scheduleView === "auto"
        ? window.matchMedia?.("(max-width: 760px)").matches
          ? "agenda"
          : "week"
        : route.scheduleView,
    );
  const lessons = state.data.study.lessons.filter(
    (lesson) =>
      (!route.course || lesson.courseId === route.course) &&
      !state.semesters.find(
        (term) => term.id === state.courseSemesters[lesson.courseId],
      )?.archived,
  );
  const names = new Map(state.data.study.courses.map((c) => [c.id, c.name])),
    conflicts = lessonConflicts(lessons),
    bounds = timetableBounds(lessons);
  const dayName = (index: number) =>
    new Intl.DateTimeFormat(state.settings.language, {
      weekday: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 9, 18 + index)));
  return (
    <section className="st-schedule">
      <header className="st-section-header">
        <div>
          <h2>{t("schedule")}</h2>
          <small className="st-muted">
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </small>
        </div>
        <div className="st-course-tools">
          <div className="st-view-toggle">
            <button
              aria-pressed={mode === "agenda"}
              onClick={() => {
                setMode("agenda");
                navigateStudio({ scheduleView: "agenda" });
              }}
            >
              <List size={16} />
              {t("agenda")}
            </button>
            <button
              aria-pressed={mode === "week"}
              onClick={() => {
                setMode("week");
                navigateStudio({ scheduleView: "week" });
              }}
            >
              <CalendarDays size={16} />
              {t("week")}
            </button>
          </div>
          <button
            className="st-primary"
            disabled={!state.data.study.courses.length}
            onClick={() =>
              edit({ kind: "lesson", courseId: route.course || undefined })
            }
          >
            <Plus size={17} />
            {t("newLesson")}
          </button>
        </div>
      </header>
      {!!conflicts.size && (
        <p className="st-notice" role="status">
          {t("scheduleConflict")} · {conflicts.size}
        </p>
      )}
      {mode === "agenda" ? (
        <>
          <nav className="st-day-picker" aria-label={t("day")}>
            {Array.from({ length: 7 }, (_, index) => (
              <button
                key={index}
                aria-pressed={day === index}
                onClick={() => {
                  setDay(index);
                  navigateStudio({ day: String(index) });
                }}
              >
                {dayName(index)}
                {index === new Date(now).getDay() && (
                  <span className="st-today-dot" />
                )}
              </button>
            ))}
          </nav>
          <div className="st-agenda-lines">
            {lessons
              .filter((l) => l.day === day)
              .sort((a, b) => a.start.localeCompare(b.start))
              .map((lesson) => (
                <button
                  key={lesson.id}
                  className={
                    "st-agenda-lesson st-color-" +
                    courseColorIndex(lesson.courseId) +
                    (conflicts.has(lesson.id) ? " has-conflict" : "")
                  }
                  onClick={() => edit({ kind: "lesson", value: lesson })}
                >
                  <span className="st-agenda-time" dir="ltr">
                    {lesson.start}
                    <small>{lesson.end}</small>
                  </span>
                  <span>
                    <strong dir="auto">{names.get(lesson.courseId)}</strong>
                    <small>
                      {t(lesson.sessionType || "lecture")} ·{" "}
                      <MapPin size={13} /> <span dir="auto">{lesson.room}</span>
                    </small>
                    {lesson.notes && <small dir="auto">{lesson.notes}</small>}
                  </span>
                </button>
              ))}
            {!lessons.some((l) => l.day === day) && (
              <EmptyState title={t("noClass")} />
            )}
          </div>
        </>
      ) : (
        <div
          className="st-week-scroll"
          tabIndex={0}
          role="region"
          aria-label={t("week")}
        >
          <div className="st-week-grid">
            <div className="st-hour-axis">
              <strong>{t("start")}</strong>
              <div style={{ height: bounds.height }}>
                {bounds.hours.map((hour) => (
                  <time
                    key={hour}
                    style={{ top: ((hour - bounds.start) * 84) / 60 }}
                    dir="ltr"
                  >
                    {String(Math.floor(hour / 60)).padStart(2, "0")}:00
                  </time>
                ))}
              </div>
            </div>
            {Array.from({ length: 7 }, (_, index) => (
              <section key={index}>
                <h3>{dayName(index)}</h3>
                <div className="st-day-track" style={{ height: bounds.height }}>
                  {layoutTimetableDay(
                    lessons.filter((l) => l.day === index),
                    bounds.start,
                  ).map(({ lesson, top, height, lane, lanes }) => (
                    <button
                      className={
                        "st-week-lesson st-color-" +
                        courseColorIndex(lesson.courseId) +
                        (conflicts.has(lesson.id) ? " has-conflict" : "")
                      }
                      key={lesson.id}
                      style={{
                        top,
                        height: Math.max(26, height - 4),
                        insetInlineStart: (lane * 100) / lanes + "%",
                        width: 100 / lanes + "%",
                      }}
                      onClick={() => edit({ kind: "lesson", value: lesson })}
                    >
                      <time dir="ltr">
                        {lesson.start}–{lesson.end}
                      </time>
                      <strong dir="auto">{names.get(lesson.courseId)}</strong>
                      <small dir="auto">{lesson.room}</small>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
