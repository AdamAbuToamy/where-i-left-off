import { useEffect, useRef, useState } from "react";
import StudyLocalized from "./StudyLocale";
import {
  GitBranch, BookOpen,
  CalendarDays,
  ChevronDown,
  Plus,
  ArrowLeft,
  Clock,
} from "lucide-react";
import type { UniversityState, StudyTask, Lesson } from "./state";
import {
  nextTrialLesson,
  trialTasks,
  trialCourseColor,
} from "./trialSelectors";
import { useStudyLanguage } from "./studyLocaleContext";
import "./university-dashboard.css";
type Tab = "overview" | "schedule" | "map";
type Props = {
  state: UniversityState;
  now: number;
  tab: Tab;
  filter: string;
  busy: boolean;
  navigate: (tab: Tab, courseId: string) => void;
  addCourse: () => void;
  addTask: () => void;
  addLesson: () => void;
  importPlan: () => void;
  exportPlan: () => void;
  buildSchedule: () => void;
  restore: (file: File) => void;
  editTask: (task: StudyTask) => void;
  editLesson: (lesson: Lesson) => void;
};
/** Read-only dashboard composition. Edits continue through the existing validated workspace. */
export default function UniversityDashboard(p: Props) {
  const language = useStudyLanguage();
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(6);
  const courses = p.state.courses.filter((c) =>
    c.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  useEffect(() => {
    const close = (event: Event) =>
      root.current
        ?.querySelectorAll<HTMLDetailsElement>("details.uni-menu[open]")
        .forEach((menu) => {
          if (
            event instanceof KeyboardEvent
              ? event.key === "Escape"
              : !menu.contains(event.target as Node)
          )
            menu.open = false;
        });
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  const locale = language === "ar" ? "ar" : language === "he" ? "he" : "en";
  const landing = p.tab === "overview" && !p.filter;
  const upcoming = nextTrialLesson(p.state.lessons, "", p.now);
  const tasks = trialTasks(p.state.tasks, "", "open", "all", p.now);
  const courseName = (id: string) =>
    p.state.courses.find((c) => c.id === id)?.name || "";
  const date = (at: number) =>
    new Date(at).toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
  const tools = (event: React.MouseEvent<HTMLDetailsElement>) => {
    if ((event.target as HTMLElement).closest("button"))
      event.currentTarget.open = false;
  };
  return (
    <StudyLocalized>
      <div className="uni-dashboard" ref={root}>
        <header className="uni-dashboard-header">
          <div>
            <span className="uni-kicker">مساحتي الدراسية</span>
            <h2>
              {landing
                ? "الجامعة"
                : p.tab === "schedule"
                  ? "الجدول الأسبوعي"
                  : p.tab === "map"
                    ? "خريطة الكورسات"
                    : <span dir="auto">{courseName(p.filter)}</span>}
            </h2>
          </div>
          <div className="uni-header-actions"><button className="uni-map-button" aria-label="خريطة الكورسات" onClick={()=>p.navigate("map", "")}><GitBranch size={17}/><span>خريطة الكورسات</span></button>
            <details className="uni-menu" onClick={tools}>
              <summary>
                <Plus size={18} />
                إضافة
                <ChevronDown size={14} />
              </summary>
              <div>
                <button onClick={p.addTask}>إضافة مهمة</button>
                <button onClick={p.addCourse}>إضافة كورس</button>
                <button
                  onClick={p.addLesson}
                  disabled={!p.state.courses.length}
                >
                  إضافة محاضرة
                </button>
              </div>
            </details>
            <details className="uni-menu uni-tools" onClick={tools}>
              <summary>
                أدوات
                <ChevronDown size={14} />
              </summary>
              <div>
                <button
                  onClick={p.buildSchedule}
                  disabled={!p.state.courses.length}
                >
                  بناء جدول الأسبوع
                </button>
                <button onClick={p.importPlan}>إضافة دفعة</button>
                <button onClick={p.exportPlan}>تصدير بياناتي</button>
                <label className="uni-restore">
                  استعادة نسخة احتياطية
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        p.restore(file);
                        e.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                      }
                      e.target.value = "";
                    }}
                  />
                </label>

                <a href="#/notifications">إعدادات الإشعارات</a>
              </div>
            </details>
          </div>
        </header>
        <nav className="uni-navigation" aria-label="عرض مساحة الجامعة">
          <button
            aria-pressed={landing}
            onClick={() => p.navigate("overview", "")}
          >
            <BookOpen size={17} />
            نظرة عامة
          </button>
          <button
            aria-pressed={p.tab === "schedule"}
            onClick={() => p.navigate("schedule", "")}
          >
            <CalendarDays size={17} />
            الجدول الأسبوعي
          </button>
          {!landing && p.tab === "overview" && (
            <span dir="auto">{courseName(p.filter)}</span>
          )}
        </nav>
        {landing && (
          <>
            <div className="uni-dashboard-focus">
              <section
                className="uni-next-lesson"
                aria-label="المحاضرة القادمة"
              >
                <div className="uni-section-label">
                  <Clock size={18} />
                  <h3>المحاضرة القادمة</h3>
                </div>
                {upcoming ? (
                  <>
                    <h4 dir="auto">{courseName(upcoming.lesson.courseId)}</h4>
                    <p>{date(upcoming.at)}</p>
                    <div className="uni-lesson-time">
                      <b dir="ltr">
                        {upcoming.lesson.start} — {upcoming.lesson.end}
                      </b>
                      <span dir="auto">{upcoming.lesson.room}</span>
                    </div>
                    <button onClick={() => p.editLesson(upcoming.lesson)}>
                      تفاصيل المحاضرة
                      <ArrowLeft size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <h4>جدولك يبدأ من هنا</h4>
                    <p>أضف محاضراتك لتجد موعدك القادم هنا.</p>
                    <button
                      disabled={!p.state.courses.length}
                      onClick={p.addLesson}
                    >
                      إضافة محاضرة
                      <Plus size={16} />
                    </button>
                  </>
                )}
              </section>
              <section className="uni-deadlines" aria-label="الأقرب للتسليم">
                <header>
                  <h3>الأقرب للتسليم</h3>
                  <span>{tasks.length} مهام مفتوحة</span>
                </header>
                {tasks.length ? (
                  <div className="uni-deadline-list">
                    {tasks.slice(0, 3).map((task) => (
                      <button
                        className="uni-deadline"
                        key={task.id}
                        onClick={() => p.editTask(task)}
                      >
                        <span>
                          <strong dir="auto">{task.title}</strong>
                          <small dir="auto">{courseName(task.courseId)}</small>
                        </span>
                        <time
                          className={
                            task.due && Date.parse(task.due) < p.now
                              ? "is-overdue"
                              : ""
                          }
                        >
                          {task.due ? date(Date.parse(task.due)) : "بدون موعد"}
                        </time>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="uni-empty">لا توجد مهام مفتوحة.</p>
                )}
                {tasks.length > 3 && (
                  <details className="uni-other-tasks">
                    <summary>بقية المهام ({tasks.length - 3})</summary>
                    {tasks.slice(3).map((task) => (
                      <button
                        key={task.id}
                        onClick={() => p.editTask(task)}
                        dir="auto"
                      >
                        {task.title}
                        <small>{courseName(task.courseId)}</small>
                      </button>
                    ))}
                  </details>
                )}
              </section>
            </div>
            <section className="uni-courses" aria-label="كورساتي">
              <header>
                <div>
                  <h3>كورساتي</h3>
                  <span>{p.state.courses.length} كورسات</span>
                </div>
              </header>
              {p.state.courses.length ? (
                <>
                  {p.state.courses.length > 6 && (
                    <input
                      className="uni-course-search"
                      type="search"
                      aria-label="بحث عن كورس"
                      placeholder="بحث عن كورس"
                      value={query}
                      onChange={(e) => {
                        setQuery(e.target.value);
                        setVisible(6);
                      }}
                    />
                  )}
                  <div className="uni-course-grid">
                    {courses.slice(0, visible).map((course) => {
                      const open = p.state.tasks.filter(
                        (t) => t.courseId === course.id && !t.done,
                      ).length;
                      const lesson = nextTrialLesson(
                        p.state.lessons,
                        course.id,
                        p.now,
                      );
                      return (
                        <button
                          className="uni-course-card"
                          key={course.id}
                          style={{
                            borderInlineStartColor: trialCourseColor(course.id),
                          }}
                          onClick={() => p.navigate("overview", course.id)}
                        >
                          <BookOpen size={20} />
                          <h4 dir="auto">{course.name}</h4>
                          <span>{open} مهام مفتوحة</span>
                          {lesson && (
                            <small>
                              {date(lesson.at)} ·{" "}
                              <b dir="ltr">{lesson.lesson.start}</b>
                            </small>
                          )}
                          <ArrowLeft className="uni-course-arrow" size={18} />
                        </button>
                      );
                    })}
                  </div>
                  {courses.length > visible && (
                    <button
                      className="uni-show-more"
                      onClick={() => setVisible((v) => v + 6)}
                    >
                      عرض المزيد
                    </button>
                  )}
                  {!courses.length && <p>لا توجد نتائج</p>}
                </>
              ) : (
                <div className="uni-course-empty">
                  <BookOpen size={30} />
                  <h4>مكان لكل كورس، وخطوة واضحة بعده.</h4>
                  <button className="primary-button" onClick={p.addCourse}>
                    إضافة أول كورس
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </StudyLocalized>
  );
}
