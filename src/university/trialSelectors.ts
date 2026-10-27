import type { Lesson, StudyTask } from "./state";
export type TaskFilter = "all" | "open" | "overdue" | "done";
export type TaskKind = "all" | StudyTask["kind"];
export function trialTasks(
  tasks: StudyTask[],
  query: string,
  status: TaskFilter,
  kind: TaskKind,
  now: number,
) {
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f\u0591-\u05c7\u064b-\u065f\u0670]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ى/g, "ي")
      .toLocaleLowerCase();
  const search = normalize(query.trim());
  return tasks
    .filter(
      (task) =>
        (kind === "all" || task.kind === kind) &&
        (status === "all" ||
          (status === "open" && !task.done) ||
          (status === "done" && task.done) ||
          (status === "overdue" &&
            !task.done &&
            !!task.due &&
            Date.parse(task.due) < now)) &&
        normalize(task.title + " " + task.notes).includes(search),
    )
    .sort(
      (a, b) =>
        Number(a.done) - Number(b.done) ||
        (Date.parse(a.due) || Infinity) - (Date.parse(b.due) || Infinity) ||
        a.title.localeCompare(b.title),
    );
}
export function trialCourseColor(id: string) {
  const colors = [
    "#385c4b",
    "#aa4c2a",
    "#4c6d91",
    "#8d6588",
    "#8a7236",
    "#377e83",
  ];
  let hash = 0;
  for (const character of id)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return colors[hash % colors.length];
}
export function nextTrialLesson(
  lessons: Lesson[],
  courseId: string,
  now: number,
) {
  return lessons
    .filter((lesson) => !courseId || lesson.courseId === courseId)
    .map((lesson) => {
      const date = new Date(now);
      date.setDate(date.getDate() + ((lesson.day - date.getDay() + 7) % 7));
      date.setHours(
        Number(lesson.start.slice(0, 2)),
        Number(lesson.start.slice(3)),
        0,
        0,
      );
      if (date.getTime() < now) date.setDate(date.getDate() + 7);
      return { lesson, at: date.getTime() };
    })
    .sort((a, b) => a.at - b.at)[0];
}
