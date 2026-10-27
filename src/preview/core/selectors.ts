import { localDateKey } from "../../lib/projects";
import type { PreviewState } from "./model";
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u0591-\u05c7\u064b-\u065f\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .toLocaleLowerCase()
    .trim();
export function courseColorIndex(id: string): number {
  let hash = 0;
  for (const character of id)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % 6;
}
export type SearchResult = {
  key: string;
  kind: "project" | "course" | "task" | "lesson";
  id: string;
  scope?: string;
  courseId?: string;
  title: string;
  detail: string;
};
export function searchPreview(
  state: PreviewState,
  query: string,
): SearchResult[] {
  const match = normalizeSearch(query);
  if (!match) return [];
  const results: SearchResult[] = [];
  const push = (row: SearchResult, body: string) => {
    if (
      normalizeSearch(row.title + " " + row.detail + " " + body).includes(match)
    )
      results.push(row);
  };
  for (const scope of state.data.scopes)
    for (const p of scope.projects)
      if (!p.trashedAt)
        push(
          {
            key: scope.id + "/" + p.id,
            kind: "project",
            id: p.id,
            scope: scope.id,
            title: p.name,
            detail: scope.name,
          },
          [
            p.nextStep,
            p.description,
            p.checkpoint,
            p.checklist,
            p.projectUrl,
            ...(p.links || []),
          ].join(" "),
        );
  for (const c of state.data.study.courses)
    push(
      {
        key: c.id,
        kind: "course",
        id: c.id,
        courseId: c.id,
        title: c.name,
        detail: "",
      },
      [c.notes, c.url, ...(c.topics || []).map((t) => t.title)].join(" "),
    );
  for (const t of state.data.study.tasks)
    push(
      {
        key: t.id,
        kind: "task",
        id: t.id,
        courseId: t.courseId,
        title: t.title,
        detail:
          state.data.study.courses.find((c) => c.id === t.courseId)?.name || "",
      },
      t.notes + " " + t.url,
    );
  for (const l of state.data.study.lessons)
    push(
      {
        key: l.id,
        kind: "lesson",
        id: l.id,
        courseId: l.courseId,
        title:
          state.data.study.courses.find((c) => c.id === l.courseId)?.name || "",
        detail: l.start + " — " + l.end,
      },
      l.room + " " + (l.notes || ""),
    );
  return results.slice(0, 80);
}
export function previewAgenda(state: PreviewState, now: number) {
  const today = localDateKey(new Date(now)),
    clock = new Date(now).toTimeString().slice(0, 5);
  const courses = state.data.study.courses.filter((c) => {
    const term = state.semesters.find(
      (t) => t.id === state.courseSemesters[c.id],
    );
    return !term?.archived;
  });
  const tasks = state.data.study.tasks
    .filter(
      (t) => !t.done && !!t.due && courses.some((c) => c.id === t.courseId),
    )
    .sort((a, b) => a.due.localeCompare(b.due));
  const overdue = tasks.filter((t) => Date.parse(t.due) < now);
  const upcoming = tasks.filter((t) => Date.parse(t.due) >= now);
  const lessons = state.data.study.lessons
    .filter(
      (l) =>
        l.day === new Date(now).getDay() &&
        l.end > clock &&
        courses.some((c) => c.id === l.courseId),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
  const projects = state.data.scopes
    .flatMap((scope) =>
      scope.projects
        .filter(
          (p) =>
            !p.archivedAt &&
            !p.trashedAt &&
            p.status !== "done" &&
            p.resourceType !== "idea",
        )
        .map((project) => ({ scope, project })),
    )
    .sort(
      (a, b) =>
        (a.project.dueDate || "9999").localeCompare(
          b.project.dueDate || "9999",
        ) || a.project.rank - b.project.rank,
    );
  return { today, overdue, upcoming, lessons, projects, courses };
}
export function previewStats(state: PreviewState, now: number) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() - 6 + index);
    const key = localDateKey(date);
    return {
      date: key,
      seconds: state.sessions
        .filter((s) => localDateKey(new Date(s.endedAt)) === key)
        .reduce((sum, s) => sum + s.seconds, 0),
    };
  });
  const projects = state.data.scopes
    .flatMap((s) => s.projects)
    .filter((p) => !p.trashedAt);
  return {
    days,
    seconds: days.reduce((sum, d) => sum + d.seconds, 0),
    completed:
      projects.filter((p) => p.status === "done").length +
      state.data.study.tasks.filter((t) => t.done).length,
    open:
      projects.filter((p) => p.status !== "done" && !p.archivedAt).length +
      state.data.study.tasks.filter((t) => !t.done).length,
    byTarget: [...new Set(state.sessions.map((s) => s.targetId))]
      .map((id) => ({
        id,
        name: state.sessions.find((s) => s.targetId === id)!.name,
        seconds: state.sessions
          .filter((s) => s.targetId === id)
          .reduce((sum, s) => sum + s.seconds, 0),
      }))
      .sort((a, b) => b.seconds - a.seconds),
  };
}
