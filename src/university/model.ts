export const MOODLE_ORIGIN = "https://moodle.bgu.ac.il";
export type Course = {
  id: string;
  name: string;
  url: string;
  notes: string;
  requires: string[];
  x: number;
  y: number;
  sourceName?: string;
};
export type StudyTask = {
  id: string;
  courseId: string;
  title: string;
  kind: "assignment" | "exam" | "task";
  due: string;
  done: boolean;
  notes: string;
  url: string;
  sourceTitle?: string;
  sourceDue?: string;
  reminderProjectId?: string;
};
export type Lesson = {
  id: string;
  courseId: string;
  day: number;
  start: string;
  end: string;
  room: string;
};
export type UniversityState = {
  version: 1;
  courses: Course[];
  tasks: StudyTask[];
  lessons: Lesson[];
  importedAt: string;
};
export type MoodleSnapshot = {
  format: "wilo-bgu-moodle-v1";
  exportedAt: string;
  courses: { id: string; name: string; url: string }[];
  events: {
    id: string;
    courseId: string;
    title: string;
    kind: StudyTask["kind"];
    due: string;
    url: string;
  }[];
  warnings: string[];
};
export const emptyUniversity = (): UniversityState => ({
  version: 1,
  courses: [],
  tasks: [],
  lessons: [],
  importedAt: "",
});
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("ملف غير صالح");
  return value as Record<string, unknown>;
}
function text(v: unknown, max = 300): string {
  if (typeof v !== "string" || v.length > max) throw new Error("نص غير صالح");
  return v;
}
function id(v: unknown): string {
  const s = text(v, 100);
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error("معرّف غير صالح");
  return s;
}
export function moodleUrl(value: unknown): string {
  if (value === "") return "";
  const u = new URL(text(value, 800));
  if (
    u.origin !== MOODLE_ORIGIN ||
    !u.pathname.startsWith("/moodle/") ||
    u.username ||
    u.password ||
    [...u.searchParams.keys()].some(
      (k) => !["id", "view", "time", "course"].includes(k),
    )
  )
    throw new Error("رابط غير مسموح");
  return u.href;
}
function iso(v: unknown): string {
  const s = text(v, 40);
  if (!s || !Number.isFinite(Date.parse(s))) throw new Error("تاريخ غير صالح");
  return new Date(s).toISOString();
}
export function parseSnapshot(raw: unknown): MoodleSnapshot {
  const r = record(raw);
  if (
    r.format !== "wilo-bgu-moodle-v1" ||
    !Array.isArray(r.courses) ||
    !Array.isArray(r.events) ||
    r.courses.length > 500 ||
    r.events.length > 3000
  )
    throw new Error("هذا ليس ملف Moodle المدعوم");
  const seen = new Set<string>();
  const courses = r.courses.map((v) => {
    const c = record(v),
      key = id(c.id);
    if (seen.has(key)) throw new Error("كورس مكرر");
    seen.add(key);
    return { id: key, name: text(c.name, 300), url: moodleUrl(c.url) };
  });
  const events = r.events.map((v) => {
    const e = record(v),
      courseId = id(e.courseId);
    if (
      !seen.has(courseId) ||
      !["assignment", "exam", "task"].includes(String(e.kind))
    )
      throw new Error("حدث غير صالح");
    return {
      id: id(e.id),
      courseId,
      title: text(e.title, 500),
      kind: e.kind as StudyTask["kind"],
      due: iso(e.due),
      url: moodleUrl(e.url),
    };
  });
  if (new Set(events.map((e) => e.id)).size !== events.length)
    throw new Error("حدث مكرر");
  return {
    format: "wilo-bgu-moodle-v1",
    exportedAt: iso(r.exportedAt),
    courses,
    events,
    warnings: Array.isArray(r.warnings)
      ? r.warnings.slice(0, 20).map((v) => text(v, 500))
      : [],
  };
}
/** Keep manual changes, notes and completion when the same source is imported again. */
export function mergeSnapshot(
  state: UniversityState,
  snapshot: MoodleSnapshot,
): UniversityState {
  const courses = new Map(state.courses.map((c) => [c.id, c]));
  const tasks = new Map(state.tasks.map((t) => [t.id, t]));
  for (const c of snapshot.courses) {
    const key = "moodle-" + c.id,
      old = courses.get(key);
    courses.set(
      key,
      old
        ? {
            ...old,
            name: old.name === old.sourceName ? c.name : old.name,
            sourceName: c.name,
            url: c.url,
          }
        : {
            ...c,
            id: key,
            sourceName: c.name,
            notes: "",
            requires: [],
            x: 40 + (courses.size % 3) * 270,
            y: 40 + Math.floor(courses.size / 3) * 160,
          },
    );
  }
  for (const e of snapshot.events) {
    const key = "moodle-" + e.id,
      old = tasks.get(key);
    tasks.set(
      key,
      old
        ? {
            ...old,
            title: old.title === old.sourceTitle ? e.title : old.title,
            due: old.due === old.sourceDue ? e.due : old.due,
            sourceTitle: e.title,
            sourceDue: e.due,
            url: e.url,
          }
        : {
            ...e,
            id: key,
            courseId: "moodle-" + e.courseId,
            sourceTitle: e.title,
            sourceDue: e.due,
            done: false,
            notes: "",
          },
    );
  }
  return {
    ...state,
    courses: [...courses.values()],
    tasks: [...tasks.values()],
    importedAt: snapshot.exportedAt,
  };
}
export function toLocalInput(isoDate: string): string {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function validateCourse(course: Course, courses: Course[]) {
  if (!course.name.trim()) throw new Error("أضف اسم الكورس");
  const edges = new Map(
    courses.map((c) => [
      c.id,
      c.id === course.id ? course.requires : c.requires,
    ]),
  );
  edges.set(course.id, course.requires);
  const visit = (key: string, path: Set<string>) => {
    if (path.has(key)) throw new Error("المتطلبات تحتوي على حلقة");
    const next = new Set(path).add(key);
    for (const dep of edges.get(key) || []) visit(dep, next);
  };
  visit(course.id, new Set());
}
export class UniversityStore {
  private readonly key: string;
  constructor(uid: string, project: string) {
    this.key = `wilo-university-v1/${project}/${uid}`;
  }
  load(): UniversityState {
    const raw = localStorage.getItem(this.key);
    if (!raw) return emptyUniversity();
    const r = JSON.parse(raw);
    if (
      r.version !== 1 ||
      !Array.isArray(r.courses) ||
      !Array.isArray(r.tasks) ||
      !Array.isArray(r.lessons)
    )
      throw new Error("تعذر قراءة بيانات الجامعة؛ صدّر نسخة قبل المتابعة");
    return r as UniversityState;
  }
  save(state: UniversityState) {
    localStorage.setItem(this.key, JSON.stringify(state));
  }
}
