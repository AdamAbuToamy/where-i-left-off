import {
  BookOpen,
  CalendarDays,
  NotebookPen,
  GraduationCap,
} from "lucide-react";
import type { Course, StudyTask } from "./model";
import StudyLocalized from "./StudyLocale";
import { useStudyLanguage } from "./studyLocaleContext";
import LinkedText from "../components/LinkedText";
export default function CourseOverview({
  course,
  tasks,
  courses,
  now,
  open,
}: {
  course?: Course;
  tasks: StudyTask[];
  courses: Course[];
  now: number;
  open: (panel: "tasks" | "materials" | "plan") => void;
}) {
  const language = useStudyLanguage();
  if (!course) return null;
  const topics = course.topics || [],
    done = topics.filter((t) => t.done).length;
  const next = tasks
    .filter((t) => !t.done && t.due && Date.parse(t.due) >= now)
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due))[0];
  const completed = tasks.filter((t) => t.done).length;
  const materials = (course.source?.sections || []).reduce(
    (n, s) => n + s.activities.length,
    0,
  );
  return (
    <StudyLocalized>
      <div className="course-overview-cards">
        <button onClick={() => open("plan")}>
          <GraduationCap size={22} />
          <span>تقدم الدراسة</span>
          <strong>
            {topics.length
              ? Math.round((done / topics.length) * 100) + "%"
              : "—"}
          </strong>
          <small>
            {done} / {topics.length} موضوع
          </small>
          <progress max={topics.length || 1} value={done} />
        </button>
        <button onClick={() => open("tasks")}>
          <CalendarDays size={22} />
          <span>التسليم القادم</span>
          {next ? (
            <>
              <strong className="course-overview-title" dir="auto">
                {next.title}
              </strong>
              <small>
                {new Date(next.due).toLocaleDateString(language, {
                  day: "numeric",
                  month: "short",
                })}
              </small>
            </>
          ) : (
            <strong className="course-overview-title">
              لا توجد مواعيد قادمة
            </strong>
          )}
        </button>
        <button onClick={() => open("materials")}>
          <NotebookPen size={22} />
          <span>الملاحظات والمواد</span>
          <strong>{materials}</strong>
          <small>{course.notes ? "ملاحظات محفوظة" : "مواد الكورس"}</small>
        </button>
        <button onClick={() => open("tasks")}>
          <BookOpen size={22} />
          <span>مهام مكتملة</span>
          <strong>{completed}</strong>
          <small>{tasks.length} مهام</small>
        </button>
        {(course.source?.description || course.notes) && (
          <details className="course-overview-description">
            <summary>عن الكورس</summary>
            <p dir="auto">
              <LinkedText text={course.source?.description || course.notes} />
            </p>
          </details>
        )}
        {!!course.requires.length && (
          <details className="course-overview-description">
            <summary>المتطلبات السابقة</summary>
            <ul>
              {course.requires.map((id) => (
                <li key={id} dir="auto">
                  {courses.find((c) => c.id === id)?.name || id}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </StudyLocalized>
  );
}
