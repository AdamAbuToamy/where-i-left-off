import { useState, useRef } from "react";
import type { Language } from "../translations";
import type { Course, StudyTask } from "../university/state";
import { resourceUrl } from "../university/state";
import { createClientId } from "../lib/clientId";
import { localDateKey } from "../lib/projects";
import { useExperience } from "./context";
import type { CoursePlan } from "./state";
import {
  emptyCoursePlan,
  checkedCoursePlan,
  weightedGrade,
  examReviewPlan,
} from "./study";
import { label, useFeatureAction, useFeatureNow } from "./helpers";
import { FeatureStatus } from "./ui";
type Props = {
  course: Course;
  tasks: StudyTask[];
  language: Language;
  onReview: (tasks: StudyTask[]) => void;
};
export default function CourseWorkspace(props: Props) {
  const context = useExperience();
  if (!context) return null;
  return (
    <details className="pilot-course-workspace">
      <summary>
        {label(props.language, "مساحة الدراسة", "Study workspace")}
      </summary>
      <CourseForm key={props.course.id} {...props} />
    </details>
  );
}
function CourseForm({ course, tasks, language, onReview }: Props) {
  const now = useFeatureNow();
  const context = useExperience()!,
    t = (a: string, e: string) => label(language, a, e),
    action = useFeatureAction(language),
    [initial] = useState(
      () =>
        context.repository.state.courses.find((c) => c.id === course.id) ||
        null,
    ),
    [draft, setDraft] = useState<CoursePlan>(
      () =>
        initial || {
          ...emptyCoursePlan(course.id),
          topics: (course.topics || []).map((t) => t.title).join("\n"),
        },
    ),
    [resource, setResource] = useState({ topic: "", title: "", url: "" }),
    [grade, setGrade] = useState({
      title: "",
      score: 0,
      maximum: 100,
      weight: 0,
    }),
    [preview, setPreview] = useState<StudyTask[]>([]),
    [effort, setEffort] = useState<Record<string, number>>({});
  const baseline = useRef(initial);
  function save(plan: CoursePlan) {
    const valid = checkedCoursePlan(plan);
    context.change((state) => {
      const current = state.courses.find((c) => c.id === course.id) || null;
      if (JSON.stringify(current) !== JSON.stringify(baseline.current))
        throw new Error("experience-conflict");
      return {
        ...state,
        courses: [...state.courses.filter((c) => c.id !== course.id), valid],
      };
    });
    baseline.current = valid;
  }
  const scores = weightedGrade({
      ...draft,
      grades: draft.grades.filter((g) => g.maximum > 0),
    }),
    plan = examReviewPlan(draft.topics, draft.examDate, localDateKey());
  return (
    <div className="pilot-panel">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(
            () => save(draft),
            t("حُفظت خطة الكورس.", "Course plan saved."),
          );
        }}
      >
        <div className="pilot-grid">
          <label>
            {t("أين وصلت؟", "Where did you stop?")}
            <textarea
              maxLength={1000}
              aria-label={t("أين وصلت؟", "Where did you stop?")}
              value={draft.checkpoint}
              onChange={(e) =>
                setDraft((d) => ({ ...d, checkpoint: e.target.value }))
              }
            />
          </label>
          <label>
            {t("الخطوة الدراسية القادمة", "Next study step")}
            <textarea
              maxLength={1000}
              aria-label={t("الخطوة الدراسية القادمة", "Next study step")}
              value={draft.nextStep}
              onChange={(e) =>
                setDraft((d) => ({ ...d, nextStep: e.target.value }))
              }
            />
          </label>
        </div>
        <button className="primary-button" disabled={action.busy}>
          {t("حفظ خطة الكورس", "Save course plan")}
        </button>
      </form>
      <FeatureStatus {...action} />
      {action.error && (
        <button
          onClick={() => {
            const current =
              context.repository.state.courses.find(
                (c) => c.id === course.id,
              ) || null;
            baseline.current = current;
            setDraft(current || emptyCoursePlan(course.id));
          }}
        >
          {t("تحميل الحقول المحفوظة", "Reload saved fields")}
        </button>
      )}
      <details>
        <summary>{t("الامتحان وخطة المراجعة", "Exam & revision plan")}</summary>
        <label>
          {t("تاريخ الامتحان", "Exam date")}
          <input
            type="date"
            value={draft.examDate}
            onChange={(e) => {
              setDraft((d) => ({ ...d, examDate: e.target.value }));
              setPreview([]);
            }}
          />
        </label>
        <label>
          {t("المواضيع — موضوع في كل سطر", "Topics — one per line")}
          <textarea
            maxLength={6000}
            aria-label={t(
              "المواضيع — موضوع في كل سطر",
              "Topics — one per line",
            )}
            value={draft.topics}
            onChange={(e) => {
              setDraft((d) => ({ ...d, topics: e.target.value }));
              setPreview([]);
            }}
          />
        </label>
        <p className="pilot-muted">
          {t(
            "توزيع للمراجعة حتى اليوم السابق للامتحان؛ راجعه قبل الإضافة.",
            "Revision is spread through the day before your exam. Review before adding.",
          )}
        </p>
        <button
          disabled={!plan.length}
          onClick={() =>
            setPreview(
              plan.map((day) => ({
                id: createClientId(),
                courseId: course.id,
                title:
                  t("مراجعة: ", "Revision: ") +
                  day.topics.join("، ").slice(0, 170),
                kind: "task",
                due: new Date(day.date + "T18:00").toISOString(),
                done: false,
                notes: day.topics.join("\n"),
                url: course.url,
              })),
            )
          }
        >
          {t("تجهيز خطة المراجعة", "Prepare revision plan")}
        </button>
        {preview.length > 0 && (
          <div>
            <ul>
              {preview.map((task) => (
                <li key={task.id}>
                  {new Date(task.due).toLocaleDateString(language)} ·{" "}
                  {task.title}
                </li>
              ))}
            </ul>
            <button
              onClick={() =>
                void action.run(
                  () => {
                    onReview(preview);
                    setPreview([]);
                  },
                  t(
                    "أُضيفت مهام المراجعة؛ راقب المزامنة.",
                    "Revision tasks added; check sync status.",
                  ),
                )
              }
            >
              {t("اعتماد خطة المراجعة", "Add revision tasks")}
            </button>
          </div>
        )}
      </details>
      <details>
        <summary>
          {t("الواجبات والوقت المتوقع", "Assignments & effort")}
        </summary>
        <div className="pilot-list">
          {tasks
            .filter((task) => task.courseId === course.id && !task.done)
            .map((task) => {
              const remaining = task.due
                  ? Math.ceil((Date.parse(task.due) - now) / 3600000)
                  : null,
                current = context.view.state.taskEffort.find(
                  (e) => e.id === task.id,
                )?.minutes;
              return (
                <article key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>
                      {remaining === null
                        ? t("بلا موعد", "No deadline")
                        : remaining < 0
                          ? t("متأخرة", "Overdue")
                          : remaining +
                            " " +
                            t("ساعة متبقية", "hours remaining")}
                    </span>
                  </div>
                  <label>
                    {t("الجهد بالدقائق", "Effort in minutes")}
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      step={5}
                      value={effort[task.id] ?? current ?? 30}
                      onChange={(e) =>
                        setEffort((old) => ({
                          ...old,
                          [task.id]: Number(e.target.value),
                        }))
                      }
                    />
                    <button
                      onClick={() =>
                        void action.run(() =>
                          context.change((state) => ({
                            ...state,
                            taskEffort: [
                              ...state.taskEffort.filter(
                                (e) => e.id !== task.id,
                              ),
                              {
                                id: task.id,
                                minutes: effort[task.id] ?? current ?? 30,
                              },
                            ],
                          })),
                        )
                      }
                    >
                      {t("حفظ التقدير", "Save estimate")}
                    </button>
                  </label>
                </article>
              );
            })}
        </div>
      </details>
      <details>
        <summary>{t("مواد حسب الموضوع", "Materials by topic")}</summary>
        <div className="pilot-grid">
          <label>
            {t("الموضوع", "Topic")}
            <input
              maxLength={100}
              value={resource.topic}
              onChange={(e) =>
                setResource((d) => ({ ...d, topic: e.target.value }))
              }
            />
          </label>
          <label>
            {t("عنوان المادة", "Resource title")}
            <input
              maxLength={200}
              value={resource.title}
              onChange={(e) =>
                setResource((d) => ({ ...d, title: e.target.value }))
              }
            />
          </label>
          <label>
            {t("رابط HTTPS عام", "Public HTTPS link")}
            <input
              type="url"
              value={resource.url}
              onChange={(e) =>
                setResource((d) => ({ ...d, url: e.target.value }))
              }
            />
          </label>
        </div>
        <button
          onClick={() =>
            void action.run(() => {
              if (
                !resource.url ||
                (!resource.title.trim() && !resource.topic.trim())
              )
                throw new Error("experience-empty");
              const next = {
                ...draft,
                resources: [
                  ...draft.resources,
                  {
                    id: createClientId(),
                    ...resource,
                    title: resource.title || resource.topic,
                    url: resourceUrl(resource.url),
                  },
                ],
              };
              save(next);
              setDraft(next);
              setResource({ topic: "", title: "", url: "" });
            })
          }
        >
          {t("إضافة المادة", "Add resource")}
        </button>
        {[...new Set(draft.resources.map((r) => r.topic))].map((topic) => (
          <section key={topic}>
            <h4>{topic || t("مواد عامة", "General materials")}</h4>
            {draft.resources
              .filter((r) => r.topic === topic)
              .map((resource) => (
                <p key={resource.id}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {resource.title} ↗
                  </a>{" "}
                  <button
                    aria-label={t("إزالة المادة", "Remove resource")}
                    onClick={() =>
                      void action.run(() => {
                        const next = {
                          ...draft,
                          resources: draft.resources.filter(
                            (r) => r.id !== resource.id,
                          ),
                        };
                        save(next);
                        setDraft(next);
                      })
                    }
                  >
                    ×
                  </button>
                </p>
              ))}
          </section>
        ))}
      </details>
      <details>
        <summary>
          {t("حساب الدرجات — اختياري", "Grade calculation — optional")}
        </summary>
        <label className="pilot-checkbox">
          <input
            type="checkbox"
            checked={draft.showGrades}
            onChange={(e) => {
              const showGrades = e.target.checked;
              void action.run(() => {
                const next = { ...draft, showGrades };
                save(next);
                setDraft(next);
              });
            }}
          />
          {t("تفعيل حساب الدرجات", "Enable grade tracking")}
        </label>
        {draft.showGrades && (
          <>
            <div className="pilot-grid">
              <label>
                {t("البند", "Component")}
                <input
                  value={grade.title}
                  maxLength={100}
                  onChange={(e) =>
                    setGrade((g) => ({ ...g, title: e.target.value }))
                  }
                />
              </label>
              {(["score", "maximum", "weight"] as const).map((field) => (
                <label key={field}>
                  {field === "score"
                    ? t("العلامة", "Score")
                    : field === "maximum"
                      ? t("من", "Out of")
                      : t("الوزن %", "Weight %")}
                  <input
                    type="number"
                    min={0}
                    max={field === "weight" ? 100 : 1000000}
                    step="any"
                    value={grade[field]}
                    onChange={(e) =>
                      setGrade((g) => ({
                        ...g,
                        [field]: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
            <button
              onClick={() =>
                void action.run(() => {
                  const next = {
                    ...draft,
                    grades: [
                      ...draft.grades,
                      { id: createClientId(), ...grade },
                    ],
                  };
                  save(next);
                  setDraft(next);
                })
              }
            >
              {t("إضافة العلامة", "Add grade")}
            </button>
            <p>
              {t("معدل الأجزاء المسجلة: ", "Average of recorded components: ")}
              {scores.gradedAverage?.toFixed(1) ?? "—"}% ·{" "}
              {t("وزن مسجل: ", "Recorded weight: ")}
              {scores.coveredWeight}% ·{" "}
              {t("وزن متبقٍ: ", "Unrecorded weight: ")}
              {scores.remainingWeight}%
            </p>
            <p>
              {t(
                "المساهمة في العلامة النهائية: ",
                "Contribution to the final grade: ",
              )}
              {scores.earnedPoints.toFixed(1)}/100
            </p>
            {draft.grades.map((g) => (
              <p key={g.id}>
                {g.title}: {g.score}/{g.maximum} · {g.weight}%{" "}
                <button
                  aria-label={t("إزالة العلامة", "Remove grade")}
                  onClick={() =>
                    void action.run(() => {
                      const next = {
                        ...draft,
                        grades: draft.grades.filter((item) => item.id !== g.id),
                      };
                      save(next);
                      setDraft(next);
                    })
                  }
                >
                  ×
                </button>
              </p>
            ))}
          </>
        )}
      </details>
      <button
        onClick={() =>
          void action.run(
            () => save(draft),
            t("حُفظت كل تفاصيل الكورس.", "All course details saved."),
          )
        }
      >
        {t("حفظ كل تفاصيل الكورس", "Save all course details")}
      </button>
    </div>
  );
}
