import { it, expect } from "vitest";
import { trialTasks, nextTrialLesson } from "../src/university/trialSelectors";
import type { StudyTask, Lesson } from "../src/university/state";
const now = Date.parse("2026-10-27T12:00:00Z");
const task = (id: string, changes: Partial<StudyTask> = {}): StudyTask => ({
  id,
  courseId: "c",
  title: id,
  kind: "assignment",
  due: "",
  done: false,
  notes: "",
  url: "",
  ...changes,
});
it("filters overdue tasks without including undated or completed work", () => {
  const data = [
    task("late", { due: "2026-10-26T12:00:00Z" }),
    task("none"),
    task("done", { done: true, due: "2026-10-26T12:00:00Z" }),
    task("future", { due: "2026-11-01T12:00:00Z" }),
  ];
  expect(trialTasks(data, "", "overdue", "all", now).map((t) => t.id)).toEqual([
    "late",
  ]);
});
it("keeps unfinished deadlines ahead of undated and completed work without mutating input", () => {
  const data = [
      task("done", { done: true }),
      task("none"),
      task("later", { due: "2026-11-01T12:00:00Z" }),
      task("first", { due: "2026-10-28T12:00:00Z" }),
    ],
    copy = structuredClone(data);
  expect(trialTasks(data, "", "all", "all", now).map((t) => t.id)).toEqual([
    "first",
    "later",
    "none",
    "done",
  ]);
  expect(data).toEqual(copy);
});
it("searches Arabic notes without diacritics and combines kind/status filters", () => {
  const data = [
    task("a", { title: "مُرَاجَعَة", notes: "أسئلة الجبر", kind: "exam" }),
    task("b", { title: "مراجعة", done: true, kind: "exam" }),
    task("c", { title: "مراجعة" }),
  ];
  expect(
    trialTasks(data, "مراجعة", "open", "exam", now).map((t) => t.id),
  ).toEqual(["a"]);
  expect(
    trialTasks(data, "اسئلة", "all", "exam", now).map((t) => t.id),
  ).toEqual(["a"]);
});
it("finds the next class across week boundaries and respects the selected course", () => {
  const clock = new Date(2026, 9, 27, 12, 0),
    day = clock.getDay(),
    lessons: Lesson[] = [
      {
        id: "past",
        courseId: "a",
        day,
        start: "09:00",
        end: "10:00",
        room: "",
      },
      {
        id: "future",
        courseId: "b",
        day: (day + 1) % 7,
        start: "09:00",
        end: "10:00",
        room: "",
      },
    ];
  expect(nextTrialLesson(lessons, "", clock.getTime())?.lesson.id).toBe(
    "future",
  );
  expect(nextTrialLesson(lessons, "a", clock.getTime())?.at).toBeGreaterThan(
    clock.getTime() + 6 * 86400000,
  );
  expect(nextTrialLesson(lessons, "missing", clock.getTime())).toBeUndefined();
});
