import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import { isAdmin } from "../lib/admin";
import {
  UniversityStore,
  emptyUniversity,
  mergeSnapshot,
  moodleUrl,
  parseSnapshot,
  toLocalInput,
  validateCourse,
} from "./model";
import type {
  Course,
  Lesson,
  MoodleSnapshot,
  StudyTask,
  UniversityState,
} from "./model";
import { prepareReminder, syncReminder } from "./reminders";
import "./university.css";
const days = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];
const kinds = { assignment: "وظيفة", exam: "امتحان / اختبار", task: "مهمة" };
const colors = [
  "#385c4b",
  "#aa4c2a",
  "#4c6d91",
  "#8d6588",
  "#8a7236",
  "#377e83",
];
const key = () => crypto.randomUUID();
function download(name: string, data: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      className="study-dialog"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button type="button" aria-label="إغلاق" onClick={close}>
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
function Workspace({ user }: { user: User }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [store] = useState(
    () => new UniversityStore(user.uid, db!.app.options.projectId || "local"),
  );
  const [initial] = useState(() => {
    try {
      return { state: store.load(), error: "" };
    } catch (e) {
      return { state: emptyUniversity(), error: (e as Error).message };
    }
  });
  const [state, setState] = useState(initial.state),
    [error, setError] = useState(initial.error),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"overview" | "schedule" | "map">("overview"),
    [filter, setFilter] = useState(""),
    [preview, setPreview] = useState<MoodleSnapshot | null>(null);
  const [editing, setEditing] = useState<
    | { kind: "course"; value: Course }
    | { kind: "task"; value: StudyTask }
    | { kind: "lesson"; value: Lesson }
    | null
  >(null);
  const drag = useRef<{
      id: string;
      x: number;
      y: number;
      startX: number;
      startY: number;
      pointX: number;
      pointY: number;
    } | null>(null),
    map = useRef<HTMLDivElement>(null),
    latest = useRef(state);
  function commit(next: UniversityState) {
    if (initial.error) throw new Error(initial.error);
    store.save(next);
    latest.current = next;
    setState(next);
  }
  async function run(action: () => Promise<void> | void) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message || "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }
  const courseName = (id: string) =>
    state.courses.find((c) => c.id === id)?.name || "بدون كورس";
  const courseColor = (id: string) =>
    colors[
      Math.max(
        0,
        state.courses.findIndex((c) => c.id === id),
      ) % colors.length
    ];
  const visible = state.tasks
    .filter((t) => !filter || t.courseId === filter)
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (Date.parse(a.due) || Infinity) - (Date.parse(b.due) || Infinity),
    );
  const pending = state.tasks.filter((t) => !t.done);
  const next = pending
    .filter((t) => t.due && Date.parse(t.due) > now)
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due))[0];
  const summaryDate = (date: string) =>
    date
      ? new Intl.DateTimeFormat("ar", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }).format(new Date(date))
      : "بدون موعد";
  function newCourse() {
    setEditing({
      kind: "course",
      value: {
        id: key(),
        name: "",
        url: "",
        notes: "",
        requires: [],
        x: 40 + (state.courses.length % 3) * 270,
        y: 40 + Math.floor(state.courses.length / 3) * 160,
      },
    });
  }
  function newTask() {
    if (!state.courses.length) {
      setError("أضف كورسًا أولًا");
      return;
    }
    setEditing({
      kind: "task",
      value: {
        id: key(),
        courseId: filter || state.courses[0].id,
        title: "",
        kind: "assignment",
        due: "",
        done: false,
        notes: "",
        url: "",
      },
    });
  }
  function newLesson() {
    if (!state.courses.length) {
      setError("أضف كورسًا أولًا");
      return;
    }
    setEditing({
      kind: "lesson",
      value: {
        id: key(),
        courseId: filter || state.courses[0].id,
        day: 0,
        start: "09:00",
        end: "10:00",
        room: "",
      },
    });
  }
  async function saveTask(task: StudyTask) {
    const linked = task.reminderProjectId
      ? await syncReminder(user.uid, task)
      : task;
    commit({
      ...latest.current,
      tasks: [
        ...latest.current.tasks.filter((t) => t.id !== linked.id),
        linked,
      ],
    });
  }
  return (
    <section
      className="study-page"
      dir="rtl"
      aria-label="صفحة الجامعة التجريبية"
    >
      <header className="study-hero">
        <div>
          <span className="study-eyebrow">
            BGU · مساحة الجامعة · تجربة شخصية
          </span>
          <h2>
            مكان لكل كورس.
            <br />
            <em>وخطوة واضحة لليوم.</em>
          </h2>
          <p>
            الكورسات والمواعيد والملاحظات، مع جدولك الأسبوعي وخريطة متطلباتك.
          </p>
        </div>
        <div className="study-hero-actions">
          <a
            className="primary-button"
            href="/university-import.html"
            target="_blank"
            rel="noopener"
          >
            ربط Moodle ←
          </a>
          <label className="secondary-button study-upload">
            استيراد ملف Moodle
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void run(async () => {
                  if (file.size > 3_000_000)
                    throw new Error("حجم الملف أكبر من المسموح");
                  setPreview(parseSnapshot(JSON.parse(await file.text())));
                });
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </header>
      <p className="study-storage">
        نسخة محلية على هذا المتصفح لحسابك فقط. لم تبدأ مزامنة خلفية مع الجامعة.{" "}
        {state.importedAt
          ? `آخر ملف مستورد: ${summaryDate(state.importedAt)}`
          : "لم تستورد بيانات بعد."}
      </p>
      <div className="study-stats">
        <article>
          <span>كورسات الفصل</span>
          <strong>{state.courses.length.toString().padStart(2, "0")}</strong>
        </article>
        <article>
          <span>مهام مفتوحة</span>
          <strong>{pending.length.toString().padStart(2, "0")}</strong>
        </article>
        <article>
          <span>الموعد القادم</span>
          <strong className="study-next" dir="auto">
            {next?.title || "فسحة للتخطيط"}
          </strong>
          <small>
            {next ? summaryDate(next.due) : "أضف أول وظيفة أو امتحان"}
          </small>
        </article>
      </div>
      {error && (
        <p className="study-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="study-success" role="status">
          {message}
        </p>
      )}
      <nav className="study-tabs" aria-label="عرض مساحة الجامعة">
        {(
          [
            ["overview", "الكورسات والمهام"],
            ["schedule", "מערכת שעות · الجدول"],
            ["map", "خريطة الكورسات"],
          ] as const
        ).map(([id, title]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {title}
          </button>
        ))}
      </nav>
      <div className="study-toolbar">
        <label>
          الكورس
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">كل الكورسات</option>
            {state.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div>
          <button className="secondary-button" onClick={newCourse}>
            + كورس
          </button>
          <button
            className="primary-button"
            onClick={tab === "schedule" ? newLesson : newTask}
          >
            {tab === "schedule" ? "+ محاضرة / تمرين" : "+ وظيفة أو مهمة"}
          </button>
        </div>
      </div>
      {tab === "overview" && (
        <div className="study-layout">
          <aside>
            <h3>كورساتي</h3>
            {!state.courses.length && (
              <div className="study-empty">
                <strong>لنبدأ بفصلك الدراسي</strong>
                <p>
                  استورد من Moodle أو أضف أول كورس. لن نملأ مساحتك ببيانات
                  وهمية.
                </p>
                <button onClick={newCourse}>إضافة كورس</button>
              </div>
            )}
            {state.courses.map((c) => (
              <article
                className="study-course"
                key={c.id}
                style={{ borderInlineStartColor: courseColor(c.id) }}
              >
                <button
                  className="study-course-name"
                  dir="auto"
                  onClick={() => setFilter(filter === c.id ? "" : c.id)}
                  aria-pressed={filter === c.id}
                >
                  {c.name}
                </button>
                <small>
                  {
                    state.tasks.filter((t) => t.courseId === c.id && !t.done)
                      .length
                  }{" "}
                  مهام مفتوحة
                </small>
                {c.notes && <p dir="auto">{c.notes}</p>}
                <div>
                  <button
                    onClick={() => setEditing({ kind: "course", value: c })}
                  >
                    تعديل وملاحظات
                  </button>
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener">
                      Moodle ↗
                    </a>
                  )}
                </div>
              </article>
            ))}
          </aside>
          <section className="study-task-list">
            <h3>ما الذي ينتظرك؟</h3>
            {!visible.length && (
              <div className="study-empty">
                <h4>كل موعد يبدأ بخطوة.</h4>
                <p>
                  أضف الوظائف والامتحانات هنا. الأحداث المستوردة من تقويم Moodle
                  تظهر أيضًا في هذه القائمة.
                </p>
              </div>
            )}
            {visible.map((t) => (
              <article
                key={t.id}
                className={`study-task ${t.done ? "is-done" : ""}`}
              >
                <div className="study-task-top">
                  <label>
                    <input
                      type="checkbox"
                      checked={t.done}
                      disabled={busy}
                      onChange={(e) =>
                        void run(() =>
                          saveTask({ ...t, done: e.target.checked }),
                        )
                      }
                    />
                    <span className="study-tag">{kinds[t.kind]}</span>
                  </label>
                  <small dir="auto" style={{ color: courseColor(t.courseId) }}>
                    {courseName(t.courseId)}
                  </small>
                </div>
                <h4 dir="auto">{t.title}</h4>
                <p
                  className={
                    !t.done && t.due && Date.parse(t.due) < now
                      ? "study-overdue"
                      : ""
                  }
                >
                  {summaryDate(t.due)}
                </p>
                {t.notes && (
                  <p className="study-task-notes" dir="auto">
                    {t.notes}
                  </p>
                )}
                <footer>
                  <button
                    disabled={busy}
                    onClick={() => setEditing({ kind: "task", value: t })}
                  >
                    تعديل
                  </button>
                  {t.url && (
                    <a href={t.url} target="_blank" rel="noopener">
                      المصدر ↗
                    </a>
                  )}
                  <button
                    disabled={busy || t.done || !t.due}
                    onClick={() =>
                      void run(async () => {
                        const prepared = prepareReminder(t);
                        commit({
                          ...latest.current,
                          tasks: latest.current.tasks.map((x) =>
                            x.id === t.id ? prepared : x,
                          ),
                        });
                        const linked = await syncReminder(
                          user.uid,
                          prepared,
                          true,
                        );
                        commit({
                          ...latest.current,
                          tasks: latest.current.tasks.map((x) =>
                            x.id === t.id ? linked : x,
                          ),
                        });
                        setMessage(
                          "تم ربط الموعد ببطاقة في مهامك. يستخدم إعدادات التذكير وساعات الهدوء الحالية.",
                        );
                      })
                    }
                  >
                    {t.reminderProjectId
                      ? "تحديث تذكير الهاتف"
                      : "ربط بتذكير الهاتف"}
                  </button>
                </footer>
              </article>
            ))}
          </section>
        </div>
      )}
      {tab === "schedule" && (
        <>
          <p className="study-hint">
            أضف الجدول يدويًا الآن؛ Moodle لا يوفّر لنا جدول المحاضرات الجامعي
            المؤكد. المواعيد حسب توقيت جهازك:{" "}
            {Intl.DateTimeFormat().resolvedOptions().timeZone}.
          </p>
          <div className="study-week">
            {days.map((day, i) => (
              <section key={day}>
                <h3>{day}</h3>
                {state.lessons
                  .filter(
                    (l) => l.day === i && (!filter || l.courseId === filter),
                  )
                  .sort((a, b) => a.start.localeCompare(b.start))
                  .map((l) => (
                    <button
                      key={l.id}
                      className="study-lesson"
                      style={{ borderColor: courseColor(l.courseId) }}
                      onClick={() => setEditing({ kind: "lesson", value: l })}
                    >
                      <time dir="ltr">
                        {l.start} — {l.end}
                      </time>
                      <strong dir="auto">{courseName(l.courseId)}</strong>
                      <small dir="auto">{l.room || "بدون قاعة"}</small>
                    </button>
                  ))}
              </section>
            ))}
          </div>
        </>
      )}
      {tab === "map" && (
        <>
          <p className="study-hint">
            اسحب الكورسات من عنوانها، أو عدّل الإحداثيات من زر «تعديل». السهم
            يبدأ من الكورس السابق ويصل إلى الكورس الذي يتطلبه. أنت تحدد
            العلاقات؛ لا نستنتجها من أسماء الكورسات.
          </p>
          <div className="study-map-scroll" dir="ltr" ref={map}>
            <div
              className="study-map"
              style={{
                width: Math.max(900, ...state.courses.map((c) => c.x + 280)),
                height: Math.max(500, ...state.courses.map((c) => c.y + 190)),
              }}
            >
              <svg aria-hidden="true" width="100%" height="100%">
                <defs>
                  <marker
                    id="study-arrow"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0 0L0 6L9 3z" fill="#718373" />
                  </marker>
                </defs>
                {state.courses.flatMap((c) =>
                  c.requires.map((id) => {
                    const from = state.courses.find((x) => x.id === id);
                    return from ? (
                      <path
                        key={id + c.id}
                        d={`M${from.x + 115} ${from.y + 100} C${from.x + 115} ${from.y + 150},${c.x + 115} ${c.y - 50},${c.x + 115} ${c.y}`}
                        fill="none"
                        stroke="#718373"
                        strokeWidth="2"
                        markerEnd="url(#study-arrow)"
                      />
                    ) : null;
                  }),
                )}
              </svg>
              {state.courses.map((c) => (
                <article
                  key={c.id}
                  className="study-node"
                  dir="rtl"
                  style={{
                    left: c.x,
                    top: c.y,
                    borderTopColor: courseColor(c.id),
                  }}
                >
                  <button
                    className="study-drag"
                    dir="auto"
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      e.currentTarget.setPointerCapture(e.pointerId);
                      drag.current = {
                        id: c.id,
                        x: e.clientX,
                        y: e.clientY,
                        startX: c.x,
                        startY: c.y,
                        pointX: c.x,
                        pointY: c.y,
                      };
                    }}
                    onPointerMove={(e) => {
                      const d = drag.current;
                      if (!d || d.id !== c.id) return;
                      d.pointX = Math.max(0, d.startX + e.clientX - d.x);
                      d.pointY = Math.max(0, d.startY + e.clientY - d.y);
                      const next = {
                        ...latest.current,
                        courses: latest.current.courses.map((x) =>
                          x.id === c.id
                            ? { ...x, x: d.pointX, y: d.pointY }
                            : x,
                        ),
                      };
                      latest.current = next;
                      setState(next);
                    }}
                    onPointerUp={() => {
                      if (drag.current) {
                        drag.current = null;
                        void run(() => commit(latest.current));
                      }
                    }}
                    onPointerCancel={() => {
                      drag.current = null;
                      void run(() => commit(latest.current));
                    }}
                  >
                    {c.name}
                  </button>
                  <small>{c.requires.length} متطلبات سابقة</small>
                  <button
                    onClick={() => setEditing({ kind: "course", value: c })}
                  >
                    تعديل
                  </button>
                </article>
              ))}
            </div>
          </div>
        </>
      )}
      <footer className="study-bottom">
        <p>
          مواعيد Moodle قد تكون جزئية؛ راجع المصدر قبل التسليم. التذكيرات لا
          تعمل من الصفحة المحلية وحدها: يلزم ربط البطاقة وتفعيل الإشعارات على
          هاتفك.
        </p>
        <button
          onClick={() =>
            download("wilo-university-backup.json", {
              ...state,
              tasks: state.tasks.map(
                ({ reminderProjectId: linked, ...task }) => ({
                  ...task,
                  reminderWasLinked: !!linked,
                }),
              ),
            })
          }
        >
          تصدير نسخة من بيانات الجامعة
        </button>
        <a href="#/notifications">إعدادات الإشعارات</a>
      </footer>
      {preview && (
        <Modal title="معاينة استيراد Moodle" close={() => setPreview(null)}>
          <p>
            {preview.courses.length} كورس · {preview.events.length} موعد
          </p>
          <ul>
            {preview.courses.map((c) => (
              <li key={c.id} dir="auto">
                {c.name}
              </li>
            ))}
          </ul>
          {preview.warnings.map((w, i) => (
            <p key={i} className="study-hint">
              {w}
            </p>
          ))}
          <p>
            سيتم دمج البيانات مع الاحتفاظ بملاحظاتك والتعديلات اليدوية. لن تُحذف
            بيانات قديمة عند غيابها من الملف الجديد.
          </p>
          <button
            className="primary-button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const nextState = mergeSnapshot(latest.current, preview);
                for (const task of nextState.tasks) {
                  const previous = latest.current.tasks.find(
                    (t) => t.id === task.id,
                  );
                  if (
                    task.reminderProjectId &&
                    previous &&
                    (task.due !== previous.due || task.title !== previous.title)
                  )
                    await syncReminder(user.uid, task);
                }
                commit(nextState);
                setPreview(null);
                setMessage("تم استيراد الكورسات والمواعيد.");
              })
            }
          >
            تأكيد الاستيراد
          </button>
        </Modal>
      )}
      {editing && (
        <Modal
          title={
            editing.kind === "course"
              ? "بيانات الكورس"
              : editing.kind === "task"
                ? "وظيفة أو مهمة أو امتحان"
                : "موعد في الجدول"
          }
          close={() => setEditing(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                if (editing.kind === "course") {
                  const course: Course = {
                    ...editing.value,
                    name: String(f.get("name")).trim(),
                    notes: String(f.get("notes")),
                    url: moodleUrl(f.get("url")),
                    requires: f.getAll("requires").map(String),
                    x: Math.min(10000, Math.max(0, Number(f.get("x")))),
                    y: Math.min(10000, Math.max(0, Number(f.get("y")))),
                  };
                  validateCourse(course, state.courses);
                  commit({
                    ...latest.current,
                    courses: [
                      ...latest.current.courses.filter(
                        (c) => c.id !== editing.value.id,
                      ),
                      course,
                    ],
                  });
                } else if (editing.kind === "task") {
                  const task: StudyTask = {
                    ...editing.value,
                    title: String(f.get("title")).trim(),
                    courseId: String(f.get("courseId")),
                    kind: String(f.get("kind")) as StudyTask["kind"],
                    due: f.get("due")
                      ? new Date(String(f.get("due"))).toISOString()
                      : "",
                    notes: String(f.get("notes")),
                    url: moodleUrl(f.get("url")),
                  };
                  if (!task.title) throw new Error("أضف عنوان المهمة");
                  await saveTask(task);
                } else {
                  const lesson: Lesson = {
                    ...editing.value,
                    courseId: String(f.get("courseId")),
                    day: Number(f.get("day")),
                    start: String(f.get("start")),
                    end: String(f.get("end")),
                    room: String(f.get("room")),
                  };
                  if (lesson.end <= lesson.start)
                    throw new Error("وقت النهاية يجب أن يكون بعد البداية");
                  commit({
                    ...latest.current,
                    lessons: [
                      ...latest.current.lessons.filter(
                        (l) => l.id !== editing.value.id,
                      ),
                      lesson,
                    ],
                  });
                }
                setEditing(null);
              });
            }}
          >
            {editing.kind === "course" ? (
              <>
                <label>
                  اسم الكورس
                  <input
                    name="name"
                    required
                    maxLength={300}
                    defaultValue={editing.value.name}
                    dir="auto"
                  />
                </label>
                <label>
                  رابط Moodle
                  <input
                    name="url"
                    type="url"
                    defaultValue={editing.value.url}
                    dir="ltr"
                  />
                </label>
                <label>
                  ملاحظات الكورس
                  <textarea
                    name="notes"
                    maxLength={10000}
                    defaultValue={editing.value.notes}
                    dir="auto"
                  />
                </label>
                <fieldset>
                  <legend>المتطلبات السابقة</legend>
                  {state.courses
                    .filter((c) => c.id !== editing.value.id)
                    .map((c) => (
                      <label className="study-check" key={c.id}>
                        <input
                          type="checkbox"
                          name="requires"
                          value={c.id}
                          defaultChecked={(
                            editing.value as Course
                          ).requires.includes(c.id)}
                        />
                        {c.name}
                      </label>
                    ))}
                </fieldset>
                <div className="study-form-grid">
                  <label>
                    موضع أفقي
                    <input
                      name="x"
                      type="number"
                      min="0"
                      max="10000"
                      defaultValue={Math.round(editing.value.x)}
                    />
                  </label>
                  <label>
                    موضع عمودي
                    <input
                      name="y"
                      type="number"
                      min="0"
                      max="10000"
                      defaultValue={Math.round(editing.value.y)}
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <label>
                  الكورس
                  <select name="courseId" defaultValue={editing.value.courseId}>
                    {state.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                {editing.kind === "task" ? (
                  <>
                    <label>
                      العنوان
                      <input
                        name="title"
                        required
                        maxLength={500}
                        defaultValue={editing.value.title}
                        dir="auto"
                      />
                    </label>
                    <div className="study-form-grid">
                      <label>
                        النوع
                        <select name="kind" defaultValue={editing.value.kind}>
                          {Object.entries(kinds).map(([id, title]) => (
                            <option key={id} value={id}>
                              {title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        الموعد والساعة
                        <input
                          type="datetime-local"
                          name="due"
                          defaultValue={toLocalInput(editing.value.due)}
                        />
                      </label>
                    </div>
                    <label>
                      ملاحظات
                      <textarea
                        name="notes"
                        maxLength={10000}
                        defaultValue={editing.value.notes}
                        dir="auto"
                      />
                    </label>
                    <label>
                      رابط المصدر في Moodle
                      <input
                        type="url"
                        name="url"
                        defaultValue={editing.value.url}
                        dir="ltr"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      اليوم
                      <select name="day" defaultValue={editing.value.day}>
                        {days.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="study-form-grid">
                      <label>
                        من
                        <input
                          name="start"
                          type="time"
                          required
                          defaultValue={editing.value.start}
                        />
                      </label>
                      <label>
                        إلى
                        <input
                          name="end"
                          type="time"
                          required
                          defaultValue={editing.value.end}
                        />
                      </label>
                    </div>
                    <label>
                      المكان / القاعة
                      <input
                        name="room"
                        maxLength={200}
                        defaultValue={editing.value.room}
                      />
                    </label>
                  </>
                )}
              </>
            )}
            <div className="study-form-actions">
              <button className="primary-button" disabled={busy}>
                حفظ
              </button>
              {state[
                editing.kind === "course"
                  ? "courses"
                  : editing.kind === "task"
                    ? "tasks"
                    : "lessons"
              ].some((x) => x.id === editing.value.id) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (editing.kind === "course") {
                        if (
                          state.tasks.some(
                            (t) => t.courseId === editing.value.id,
                          ) ||
                          state.lessons.some(
                            (l) => l.courseId === editing.value.id,
                          )
                        )
                          throw new Error(
                            "انقل أو احذف مهام ومحاضرات الكورس أولًا",
                          );
                        commit({
                          ...state,
                          courses: state.courses
                            .filter((c) => c.id !== editing.value.id)
                            .map((c) => ({
                              ...c,
                              requires: c.requires.filter(
                                (id) => id !== editing.value.id,
                              ),
                            })),
                        });
                      } else if (editing.kind === "task") {
                        if (editing.value.reminderProjectId)
                          await syncReminder(user.uid, {
                            ...editing.value,
                            done: true,
                          });
                        commit({
                          ...state,
                          tasks: state.tasks.filter(
                            (t) => t.id !== editing.value.id,
                          ),
                        });
                      } else
                        commit({
                          ...state,
                          lessons: state.lessons.filter(
                            (l) => l.id !== editing.value.id,
                          ),
                        });
                      setEditing(null);
                    })
                  }
                >
                  حذف
                </button>
              )}
            </div>
            {error && (
              <p role="alert" className="study-error">
                {error}
              </p>
            )}
          </form>
        </Modal>
      )}
    </section>
  );
}
export default function UniversityPage({ user }: { user: User }) {
  return isAdmin(user.email, user.emailVerified) && db ? (
    <Workspace key={user.uid} user={user} />
  ) : (
    <p role="alert">هذه الصفحة تجريبية ومتاحـة لحساب التجربة فقط.</p>
  );
}
