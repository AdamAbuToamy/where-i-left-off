import { useState } from "react";
import { CalendarDays, Clock, MapPin, Pencil } from "lucide-react";
import Timetable from "./Timetable";
import LinkedText from "../components/LinkedText";
import StudyLocalized from "./StudyLocale";
import { translateStudyText } from "./studyLocaleContext";
import type { Course, Lesson } from "./state";
import type { Language } from "../translations";
export default function UniversityTrialSchedule({
  courses,
  lessons,
  filter,
  conflicts,
  language,
  courseColor,
  edit,
}: {
  courses: Course[];
  lessons: Lesson[];
  filter: string;
  conflicts: Set<string>;
  language: Language;
  courseColor: (id: string) => string;
  edit: (lesson: Lesson) => void;
}) {
  const [mode, setMode] = useState<"day" | "week">(() =>
      innerWidth < 760 ? "day" : "week",
    ),
    [day, setDay] = useState(new Date().getDay());
  const visible = lessons
    .filter(
      (lesson) => (!filter || lesson.courseId === filter) && lesson.day === day,
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  return (
    <StudyLocalized>
      <section className="study-trial-schedule">
        <nav
          className="study-trial-actions"
          aria-label={translateStudyText("عرض الجدول", language)}
        >
          <button aria-pressed={mode === "day"} onClick={() => setMode("day")}>
            <Clock size={16} />
            جدول اليوم
          </button>
          <button
            aria-pressed={mode === "week"}
            onClick={() => setMode("week")}
          >
            <CalendarDays size={16} />
            الجدول الأسبوعي
          </button>
        </nav>
        {mode === "week" ? (
          <Timetable
            courses={courses}
            lessons={lessons}
            courseFilter={filter}
            conflicts={conflicts}
            language={language}
            courseColor={courseColor}
            onEdit={edit}
          />
        ) : (
          <>
            <label className="study-trial-day">
              اليوم
              <select
                aria-label={translateStudyText("اليوم", language)}
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
              >
                {[
                  "الأحد",
                  "الاثنين",
                  "الثلاثاء",
                  "الأربعاء",
                  "الخميس",
                  "الجمعة",
                  "السبت",
                ].map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {visible.map((lesson) => (
              <article
                key={lesson.id}
                className={
                  "study-trial-lesson " +
                  (conflicts.has(lesson.id) ? "has-conflict" : "")
                }
                style={{ borderInlineStartColor: courseColor(lesson.courseId) }}
              >
                <time dir="ltr">
                  {lesson.start} — {lesson.end}
                </time>
                <div>
                  <strong dir="auto">
                    {
                      courses.find((course) => course.id === lesson.courseId)
                        ?.name
                    }
                  </strong>
                  {lesson.room && (
                    <small>
                      <MapPin size={14} />
                      {lesson.room}
                    </small>
                  )}
                  {lesson.notes && (
                    <p dir="auto">
                      <LinkedText text={lesson.notes} />
                    </p>
                  )}
                  {conflicts.has(lesson.id) && (
                    <small className="study-overdue">تعارض في الوقت</small>
                  )}
                </div>
                <button
                  aria-label={
                    translateStudyText("تعديل", language) +
                    " " +
                    (courses.find((course) => course.id === lesson.courseId)
                      ?.name || "")
                  }
                  onClick={() => edit(lesson)}
                >
                  <Pencil size={16} />
                  <span>تعديل</span>
                </button>
              </article>
            ))}
            {!visible.length && (
              <p className="study-empty">لا توجد محاضرات في هذا اليوم</p>
            )}
          </>
        )}
      </section>
    </StudyLocalized>
  );
}
