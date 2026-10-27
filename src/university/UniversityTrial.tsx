import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig } from "motion/react";
import {
  BookOpen,
  CalendarDays,
  Clock,
  Copy,
  ExternalLink,
  FileText,
  GraduationCap,
  ListChecks,
  NotebookPen,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import type { Course, StudyTask, UniversityState } from "./state";
import type { Language } from "../translations";
import CourseNavigator from "./CourseNavigator";
import CourseContent from "./CourseContent";
import LinkedText from "../components/LinkedText";
import StudyLocalized from "./StudyLocale";
import { translateStudyText } from "./studyLocaleContext";
import { nextTrialLesson, trialTasks } from "./trialSelectors";
import type { TaskFilter, TaskKind } from "./trialSelectors";
const panels = {
  overview: "ملخص الكورس",
  tasks: "المهام والمواعيد",
  materials: "الملاحظات والمواد",
  plan: "خطة الدراسة",
} as const;
type Panel = keyof typeof panels;
const icons = {
  overview: BookOpen,
  tasks: ListChecks,
  materials: NotebookPen,
  plan: GraduationCap,
};
function readPanel(): Panel {
  const panel = new URLSearchParams(location.hash.split("?")[1]).get("panel");
  return panel && Object.hasOwn(panels, panel) ? (panel as Panel) : "overview";
}
function setPanel(panel: Panel) {
  const params = new URLSearchParams(location.hash.split("?")[1]);
  params.set("panel", panel);
  location.hash = "/university?" + params.toString();
}
type Props = {
  state: UniversityState;
  selected?: Course;
  filter: string;
  now: number;
  busy: boolean;
  language: Language;
  courseColor: (id: string) => string;
  select: (id: string) => void;
  addCourse: () => void;
  addTask: () => void;
  editCourse: (course: Course) => void;
  template: (course: Course) => void;
  toggleTopic: (course: Course, id: string) => void;
  renderTasks: (tasks: StudyTask[]) => ReactNode;
};
/** Presentation only: all mutations still use the original University's callbacks and repository. */
export default function UniversityTrial(props: Props) {
  const {
    state,
    selected,
    filter,
    now,
    busy,
    language,
    courseColor,
    select,
    addCourse,
    addTask,
    editCourse,
    template,
    toggleTopic,
    renderTasks,
  } = props;
  const [panel, updatePanel] = useState(readPanel),
    [query, setQuery] = useState(""),
    [filtersOpen, setFiltersOpen] = useState(false),
    [status, setStatus] = useState<TaskFilter>("all"),
    [kind, setKind] = useState<TaskKind>("all"),
    [requestedPage, setPage] = useState(0),
    [reduced, setReduced] = useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  useEffect(() => {
    const changed = () => updatePanel(readPanel());
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)"),
      changed = () => setReduced(media.matches);
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  const tasks = state.tasks.filter(
      (task) => !filter || task.courseId === filter,
    ),
    pending = tasks.filter((task) => !task.done),
    late = pending.filter((task) => task.due && Date.parse(task.due) < now),
    next = nextTrialLesson(state.lessons, selected?.id || filter, now),
    filtered = trialTasks(tasks, query, status, kind, now),
    page = Math.min(
      requestedPage,
      Math.max(0, Math.ceil(filtered.length / 20) - 1),
    );
  const name = (id: string) =>
    state.courses.find((course) => course.id === id)?.name || "";
  return (
    <StudyLocalized>
      <MotionConfig reducedMotion={reduced ? "always" : "user"}>
        <div className="study-layout study-trial-layout">
          <CourseNavigator
            key={filter}
            courses={state.courses}
            tasks={state.tasks}
            selectedId={selected?.id || ""}
            filter={filter}
            onSelect={select}
            courseColor={courseColor}
            onAdd={addCourse}
          />
          <section className="study-task-list study-trial-panel">
            <header
              data-study-course={selected?.id}
              className="study-trial-course-heading"
              style={{
                borderInlineStartColor: selected
                  ? courseColor(selected.id)
                  : undefined,
              }}
            >
              <div>
                <small>{selected ? "الكورس المفتوح" : "كل الكورسات"}</small>
                <h3 dir="auto">
                  {selected?.name ||
                    translateStudyText("الكورسات والمهام", language)}
                </h3>
              </div>
              {selected && (
                <div className="study-trial-actions">
                  <button
                    className="study-link-button"
                    onClick={() => editCourse(selected)}
                  >
                    <Pencil size={16} />
                    تعديل الكورس
                  </button>
                  <details className="study-trial-menu">
                    <summary>المزيد</summary>
                    <button onClick={() => template(selected)}>
                      <Copy size={15} />
                      استخدام كقالب
                    </button>
                    {selected.url && (
                      <a
                        href={selected.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={15} />
                        فتح الكورس
                      </a>
                    )}
                  </details>
                </div>
              )}
            </header>
            <nav
              className="study-trial-tabs"
              aria-label={translateStudyText("تفاصيل الكورس", language)}
            >
              {(Object.keys(panels) as Panel[]).map((key) => {
                const Icon = icons[key];
                return (
                  <button
                    key={key}
                    aria-pressed={panel === key}
                    onClick={() => {
                      setPage(0);
                      setPanel(key);
                    }}
                  >
                    <Icon size={16} />
                    <span>{panels[key]}</span>
                  </button>
                );
              })}
            </nav>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={panel + "/" + filter}
                data-study-panel={panel}
                initial={{ opacity: 0, y: reduced ? 0 : 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : 0.16 }}
              >
                {panel === "overview" && (
                  <>
                    <div className="study-trial-summary">
                      <button
                        onClick={() => {
                          setFiltersOpen(true);
                          setStatus("open");
                          setPanel("tasks");
                        }}
                      >
                        <ListChecks size={17} />
                        <strong>{pending.length}</strong>مهام مفتوحة
                      </button>
                      <button
                        className={late.length ? "study-trial-late" : ""}
                        onClick={() => {
                          setFiltersOpen(true);
                          setStatus("overdue");
                          setPanel("tasks");
                        }}
                      >
                        <Clock size={17} />
                        <strong>{late.length}</strong>مهام متأخرة
                      </button>
                    </div>
                    {next && (
                      <section className="study-trial-next">
                        <CalendarDays size={18} />
                        <div>
                          <small>المحاضرة القادمة</small>
                          <strong dir="auto">
                            {name(next.lesson.courseId)}
                          </strong>
                          <span>
                            {new Intl.DateTimeFormat(language, {
                              weekday: "long",
                            }).format(new Date(next.at))}{" "}
                            ·{" "}
                            <bdi>
                              {next.lesson.start} — {next.lesson.end}
                            </bdi>
                            {next.lesson.room ? " · " + next.lesson.room : ""}
                          </span>
                        </div>
                      </section>
                    )}
                    {selected?.notes && (
                      <details
                        className="study-trial-notes"
                        open={selected.notes.length < 500}
                      >
                        <summary>
                          <NotebookPen size={16} />
                          ملاحظات الكورس
                        </summary>
                        <p dir="auto">
                          <LinkedText text={selected.notes} />
                        </p>
                      </details>
                    )}
                    <header className="study-trial-section-heading">
                      <h4>الأقرب للتسليم</h4>
                      <button
                        className="study-link-button"
                        disabled={!state.courses.length}
                        onClick={addTask}
                      >
                        <Plus size={16} />
                        إضافة مهمة
                      </button>
                    </header>
                    {renderTasks(
                      trialTasks(pending, "", "open", "all", now).slice(0, 4),
                    )}
                    {!pending.length && (
                      <p className="study-empty">لا توجد مهام للعرض</p>
                    )}
                  </>
                )}
                {panel === "tasks" && (
                  <>
                    <details
                      className="study-trial-filters"
                      open={filtersOpen}
                      onToggle={(event) =>
                        setFiltersOpen(event.currentTarget.open)
                      }
                    >
                      <summary>
                        <Search size={16} />
                        البحث والتصفية
                      </summary>
                      <div>
                        <label>
                          بحث في المهام
                          <input
                            type="search"
                            value={query}
                            onChange={(e) => {
                              setQuery(e.target.value);
                              setPage(0);
                            }}
                          />
                        </label>
                        <label>
                          حالة المهمة
                          <select
                            aria-label={translateStudyText(
                              "حالة المهمة",
                              language,
                            )}
                            value={status}
                            onChange={(e) => {
                              setStatus(e.target.value as TaskFilter);
                              setPage(0);
                            }}
                          >
                            <option value="all">كل المهام</option>
                            <option value="open">مهام مفتوحة</option>
                            <option value="overdue">مهام متأخرة</option>
                            <option value="done">مهام مكتملة</option>
                          </select>
                        </label>
                        <label>
                          نوع المهمة
                          <select
                            aria-label={translateStudyText(
                              "نوع المهمة",
                              language,
                            )}
                            value={kind}
                            onChange={(e) => {
                              setKind(e.target.value as TaskKind);
                              setPage(0);
                            }}
                          >
                            <option value="all">كل الأنواع</option>
                            <option value="assignment">وظيفة</option>
                            <option value="exam">امتحان / اختبار</option>
                            <option value="task">مهمة</option>
                          </select>
                        </label>
                      </div>
                    </details>
                    <header className="study-trial-section-heading">
                      <h4>
                        الواجبات والمواعيد <small>{filtered.length}</small>
                      </h4>
                      <button
                        className="study-link-button"
                        disabled={!state.courses.length}
                        onClick={addTask}
                      >
                        <Plus size={16} />
                        إضافة مهمة
                      </button>
                    </header>
                    {renderTasks(filtered.slice(page * 20, page * 20 + 20))}
                    {!filtered.length && (
                      <p className="study-empty">لا توجد مهام مطابقة</p>
                    )}
                    {filtered.length > 20 && (
                      <nav
                        className="study-trial-pagination"
                        aria-label={translateStudyText(
                          "صفحات المهام",
                          language,
                        )}
                      >
                        <button
                          disabled={!page}
                          onClick={() => setPage(page - 1)}
                        >
                          السابق
                        </button>
                        <span>
                          {page + 1} / {Math.ceil(filtered.length / 20)}
                        </span>
                        <button
                          disabled={(page + 1) * 20 >= filtered.length}
                          onClick={() => setPage(page + 1)}
                        >
                          التالي
                        </button>
                      </nav>
                    )}
                  </>
                )}
                {(panel === "materials" || panel === "plan") &&
                  (selected ? (
                    <>
                      <h4 className="study-trial-section-heading">
                        {panel === "materials" ? (
                          <FileText size={17} />
                        ) : (
                          <GraduationCap size={17} />
                        )}
                        <span>{panels[panel]}</span>
                      </h4>
                      {panel === "materials" && (
                        <>
                          {selected.notes && (
                            <p className="study-trial-material-note" dir="auto">
                              <LinkedText text={selected.notes} />
                            </p>
                          )}
                          {selected.url && (
                            <a
                              className="study-trial-resource"
                              href={selected.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink size={16} />
                              فتح الكورس
                            </a>
                          )}
                        </>
                      )}
                      <CourseContent
                        course={selected}
                        busy={busy}
                        view={panel}
                        onToggleTopic={(id) => toggleTopic(selected, id)}
                      />
                      {panel === "plan" && (
                        <button
                          className="study-link-button"
                          onClick={() => editCourse(selected)}
                        >
                          <Pencil size={15} />
                          تعديل خطة الدراسة
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="study-empty">
                      اختر كورسًا لعرض ملاحظاته وخطة دراسته.
                    </p>
                  ))}
              </motion.div>
            </AnimatePresence>
          </section>
        </div>
      </MotionConfig>
    </StudyLocalized>
  );
}
