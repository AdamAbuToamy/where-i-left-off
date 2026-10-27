import { beforeEach, expect, it } from "vitest";
import { planAssistantChanges } from "../src/assistant/actions";
import { StudioRepository } from "../src/studio/core/repository";
import { StudioError } from "../src/studio/core/model";
import type {
  StudioJournal,
  StudioPersistence,
  StudioState,
} from "../src/studio/core/model";
import { studioSeed } from "../src/studio/core/seed";
import {
  validateStudioJournal,
  validateStudioState,
} from "../src/studio/core/validation";
import { studioCalendar, studioCsv } from "../src/studio/core/calendar";
import {
  courseColorIndex,
  searchStudio,
  studioAgenda,
  studioStats,
} from "../src/studio/core/selectors";
const now = Date.parse("2026-10-27T12:00:00Z");
class MemoryStore implements StudioPersistence {
  journal: StudioJournal | null = null;
  fail = false;
  private queue: Promise<unknown> = Promise.resolve();
  read() {
    return structuredClone(this.journal);
  }
  subscribe() {
    return () => {};
  }
  transact(
    update: (current: StudioJournal | null) => StudioJournal,
  ): Promise<StudioJournal> {
    const next = this.queue.then(() => {
      if (this.fail) throw new Error("quota");
      const result = validateStudioJournal(update(this.read()));
      this.journal = result;
      return structuredClone(result);
    });
    this.queue = next.catch(() => {});
    return next;
  }
}
let seed: StudioState, store: MemoryStore, repo: StudioRepository;
beforeEach(() => {
  seed = studioSeed(now, "Administrator", "ar");
  store = new MemoryStore();
  repo = new StudioRepository(
    store,
    () => structuredClone(seed),
    () => now,
  );
});
it("starts from valid disposable data and never mutates the supplied seed", async () => {
  expect(validateStudioState(seed).data.study.courses).toHaveLength(4);
  const copy = structuredClone(seed);
  await repo.execute({ kind: "settings", values: { mode: "dark" } }, 0);
  expect(seed).toEqual(copy);
  expect(repo.read().current.settings.mode).toBe("dark");
});
it("plans a compound section and card through the existing domain with resolved aliases", async () => {
  await repo.execute(
    {
      kind: "actions",
      actions: [
        {
          target: "sections",
          action: "create",
          id: "new-section",
          values: { name: "ادم" },
        },
        {
          target: "projects",
          action: "create",
          id: "new-card",
          values: {
            name: "عمار",
            sectionId: "new-section",
            description: "مروان",
            dueDate: "2026-10-28",
          },
        },
      ],
    },
    0,
  );
  const scope = repo.read().current.data.scopes[0],
    section = scope.sections.find((s) => s.name === "ادم")!,
    project = scope.projects.find((p) => p.name === "عمار")!;
  expect(project.sectionId).toBe(section.id);
  expect(project.description).toBe("مروان");
  expect(project.dueDate).toBe("2026-10-28");
});
it("rejects an invalid last step without saving the valid earlier step", async () => {
  await expect(
    repo.execute(
      {
        kind: "actions",
        actions: [
          {
            target: "projects",
            action: "create",
            id: "valid",
            values: { name: "Valid" },
          },
          {
            target: "tasks",
            action: "create",
            id: "bad",
            values: { title: "Missing course", courseId: "absent" },
          },
        ],
      },
      0,
    ),
  ).rejects.toThrow();
  expect(store.journal).toBeNull();
  expect(repo.read().current).toEqual(seed);
});
it("preserves course references and validates reversed class times and cyclic prerequisites", async () => {
  await expect(
    repo.execute(
      {
        kind: "actions",
        actions: [
          {
            target: "lessons",
            action: "create",
            id: "bad-clock",
            values: {
              courseId: "course-0",
              day: 2,
              start: "12:00",
              end: "11:00",
            },
          },
        ],
      },
      0,
    ),
  ).rejects.toThrow();
  await expect(
    repo.execute(
      {
        kind: "actions",
        actions: [
          {
            target: "courses",
            action: "update",
            id: "course-0",
            values: { requires: ["course-3"] },
          },
        ],
      },
      0,
    ),
  ).rejects.toThrow();
  await expect(
    repo.execute(
      {
        kind: "actions",
        actions: [{ target: "courses", action: "delete", id: "course-0" }],
      },
      0,
    ),
  ).rejects.toThrow();
  expect(repo.read().revision).toBe(0);
});
it("serializes competing tabs and rejects the stale revision instead of overwriting", async () => {
  const second = new StudioRepository(
    store,
    () => seed,
    () => now,
  );
  const results = await Promise.allSettled([
    repo.execute({ kind: "settings", values: { mode: "dark" } }, 0),
    second.execute(
      { kind: "settings", values: { displayName: "Other tab" } },
      0,
    ),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  expect(repo.read().revision).toBe(1);
});
it("rejects a previously reviewed model proposal after another edit", async () => {
  const proposal = {
    revision: 0,
    changes: planAssistantChanges(
      seed.data,
      [
        {
          target: "projects",
          action: "update",
          id: "card-0",
          values: { name: "Proposal" },
        },
      ],
      now,
    ),
    controls: [],
  };
  await repo.execute({ kind: "settings", values: { mode: "dark" } }, 0);
  await expect(repo.execute({ kind: "proposal", proposal }, 1)).rejects.toEqual(
    new StudioError("conflict"),
  );
  expect(
    repo.read().current.data.scopes[0].projects.find((p) => p.id === "card-0")
      ?.name,
  ).not.toBe("Proposal");
});
it("applies a full validated model proposal and local settings atomically", async () => {
  const proposal = {
    revision: 0,
    changes: planAssistantChanges(
      seed.data,
      [
        {
          target: "projects",
          action: "update",
          id: "card-0",
          values: { name: "Reviewed" },
        },
      ],
      now,
    ),
    controls: [{ kind: "language" as const, values: { language: "he" } }],
  };
  await repo.execute({ kind: "proposal", proposal }, 0);
  expect(repo.read().current.settings.language).toBe("he");
  expect(
    repo.read().current.data.scopes[0].projects.find((p) => p.id === "card-0")
      ?.name,
  ).toBe("Reviewed");
  await repo.execute({ kind: "undo" }, 1);
  expect(repo.read().current).toEqual(seed);
});
it("rejects forged persisted proposal IDs, permanent deletion and invalid settings", async () => {
  const change = planAssistantChanges(
    seed.data,
    [
      {
        target: "projects",
        action: "update",
        id: "card-0",
        values: { name: "Reviewed" },
      },
    ],
    now,
  )[0];
  await expect(
    repo.execute(
      {
        kind: "proposal",
        proposal: {
          revision: 0,
          changes: [
            {
              ...change,
              after: { ...(change.after as object), id: "other-id" },
            },
          ],
          controls: [],
        },
      },
      0,
    ),
  ).rejects.toThrow();
  await expect(
    repo.execute(
      {
        kind: "proposal",
        proposal: {
          revision: 0,
          changes: [{ ...change, after: null }],
          controls: [],
        },
      },
      0,
    ),
  ).rejects.toThrow();
  await expect(
    repo.execute({ kind: "settings", values: { language: "xx" as "ar" } }, 0),
  ).rejects.toThrow();
  expect(store.journal).toBeNull();
});
it("preserves copied member-only workspaces as read-only", async () => {
  seed.data.scopes[0].role = "member";
  await expect(
    repo.execute(
      {
        kind: "actions",
        actions: [
          {
            target: "projects",
            action: "update",
            id: "card-0",
            values: { name: "Not permitted" },
          },
        ],
      },
      0,
    ),
  ).rejects.toThrow("studio-permission");
});
it("keeps undo, redo and recovery after repository reconstruction", async () => {
  await repo.execute({ kind: "checkpoint" }, 0);
  await repo.execute({ kind: "settings", values: { mode: "dark" } }, 1);
  repo = new StudioRepository(
    store,
    () => seed,
    () => now,
  );
  await repo.execute({ kind: "undo" }, 2);
  expect(repo.read().current.settings.mode).toBe("light");
  await repo.execute({ kind: "redo" }, 3);
  expect(repo.read().current.settings.mode).toBe("dark");
  await repo.execute({ kind: "restore" }, 4);
  expect(repo.read().current).toEqual(seed);
  await repo.execute({ kind: "clear-history" }, 5);
  expect(repo.read().undo).toHaveLength(0);
  expect(repo.read().checkpoint).toEqual(seed);
});
it("refuses unavailable recovery or storage failure without discarding current data", async () => {
  await expect(repo.execute({ kind: "restore" }, 0)).rejects.toThrow(
    "studio-missing-checkpoint",
  );
  await repo.execute({ kind: "settings", values: { mode: "dark" } }, 0);
  const before = store.read();
  store.fail = true;
  await expect(
    repo.execute({ kind: "settings", values: { mode: "light" } }, 1),
  ).rejects.toThrow("quota");
  expect(store.read()).toEqual(before);
});
it("bounds undo history without limiting current data to a single page", async () => {
  for (let i = 0; i < 25; i++)
    await repo.execute(
      { kind: "settings", values: { displayName: "Name " + i } },
      i,
    );
  expect(repo.read().undo).toHaveLength(20);
  expect(repo.read().current.settings.displayName).toBe("Name 24");
});
it("archives completed cards only when the preview preference is enabled", async () => {
  await repo.execute({ kind: "settings", values: { autoArchive: true } }, 0);
  await repo.execute(
    {
      kind: "actions",
      actions: [
        {
          target: "projects",
          action: "update",
          id: "card-0",
          values: { status: "done" },
        },
      ],
    },
    1,
  );
  expect(
    repo.read().current.data.scopes[0].projects.find((p) => p.id === "card-0")
      ?.archivedAt,
  ).toBe(now);
});
it("creates semesters, archives them without deleting records and allows restoration", async () => {
  await repo.execute(
    {
      kind: "semester",
      value: {
        id: "old",
        name: "Old term",
        start: "2026-01-01",
        end: "2026-06-01",
        archived: true,
      },
    },
    0,
  );
  await repo.execute(
    { kind: "assign-semester", courseId: "course-0", semesterId: "old" },
    1,
  );
  expect(
    studioAgenda(repo.read().current, now).courses.some(
      (c) => c.id === "course-0",
    ),
  ).toBe(false);
  expect(repo.read().current.data.study.courses).toHaveLength(4);
  await repo.execute({ kind: "undo" }, 2);
  expect(studioAgenda(repo.read().current, now).courses).toHaveLength(4);
});
it("rejects invalid semester dates and unknown term assignments", async () => {
  await expect(
    repo.execute(
      {
        kind: "semester",
        value: {
          id: "bad",
          name: "Bad",
          start: "2026-12-01",
          end: "2026-01-01",
          archived: false,
        },
      },
      0,
    ),
  ).rejects.toThrow();
  await expect(
    repo.execute(
      { kind: "assign-semester", courseId: "course-0", semesterId: "missing" },
      0,
    ),
  ).rejects.toThrow();
});
it("does not set reminders without a dated open task and removes them on completion", async () => {
  await repo.execute({ kind: "reminder", taskId: "task-0" }, 0);
  await repo.execute(
    {
      kind: "actions",
      actions: [
        {
          target: "tasks",
          action: "update",
          id: "task-0",
          values: { done: true },
        },
      ],
    },
    1,
  );
  expect(repo.read().current.reminders).toEqual([]);
  await expect(
    repo.execute({ kind: "reminder", taskId: "task-0" }, 2),
  ).rejects.toThrow();
});
it("imports validated state only, rejecting unsafe links and unsupported versions", () => {
  const unsafe = structuredClone(seed);
  unsafe.data.scopes[0].projects[0].projectUrl = "javascript:alert(1)";
  expect(() => validateStudioState(unsafe)).toThrow();
  expect(() => validateStudioState({ ...seed, version: 2 })).toThrow();
  expect(() =>
    validateStudioJournal({
      version: 1,
      revision: -1,
      current: seed,
      undo: [],
      redo: [],
      checkpoint: null,
    }),
  ).toThrow();
});
it("searches Arabic diacritics, course notes, tasks, links and classes with stable course colors", () => {
  seed.data.study.courses[0].name = "إدارة مَوارِد";
  expect(
    searchStudio(seed, "ادارة موارد").some((r) => r.kind === "course"),
  ).toBe(true);
  expect(
    searchStudio(seed, "ocw.mit.edu").some((r) => r.kind === "course"),
  ).toBe(true);
  expect(searchStudio(seed, "90 /").some((r) => r.kind === "lesson")).toBe(
    true,
  );
  const color = courseColorIndex(seed.data.study.courses[0].id);
  seed.data.study.courses.reverse();
  expect(courseColorIndex("course-0")).toBe(color);
});
it("exports parseable bounded recurring calendar data with escaped multilingual content", () => {
  seed.data.study.tasks[0].title = "اسم, مهمة; متعددة\nBEGIN:VEVENT";
  seed.data.study.tasks[0].notes = "ملاحظات طويلة ".repeat(90);
  const calendar = studioCalendar(seed, now);
  expect(calendar.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
  expect(calendar).toContain("RRULE:FREQ=WEEKLY;UNTIL=");
  expect(calendar).toContain("SUMMARY:اسم\\, مهمة\\; متعددة\\nBEGIN:VEVENT");
  expect(calendar).not.toContain("\r\nBEGIN:VEVENT\r\nBEGIN:VEVENT");
  expect(
    calendar
      .split("\r\n")
      .every((line) => new TextEncoder().encode(line).length <= 75),
  ).toBe(true);
  expect(calendar).toContain(
    "DTSTART:" +
      seed.data.study.tasks[0].due
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}Z$/, "Z"),
  );
});
it("neutralizes formula injection in CSV fields", () => {
  seed.data.scopes[0].projects[0].name = '=HYPERLINK("https://evil.test")';
  expect(studioCsv(seed)).toContain('"\'=HYPERLINK(""https://evil.test"")"');
});
it("uses actual focus sessions for weekly statistics", async () => {
  const before = studioStats(seed, now).seconds;
  await repo.execute(
    {
      kind: "session",
      value: {
        id: "focus",
        targetId: "course-0",
        name: "Algorithms",
        seconds: 900,
        endedAt: now,
      },
    },
    0,
  );
  expect(studioStats(repo.read().current, now).seconds).toBe(before + 900);
  await repo.execute({ kind: "undo" }, 1);
  expect(studioStats(repo.read().current, now).seconds).toBe(before);
});

it("creates a course in its selected semester atomically and rejects missing semesters", async () => {
  const command = {
    kind: "actions" as const,
    semesterId: seed.semesters[0].id,
    actions: [
      {
        target: "courses" as const,
        action: "create" as const,
        id: "selected-course",
        values: { name: "Selected semester course" },
      },
    ],
  };
  const next = await repo.execute(command, 0);
  const course = next.current.data.study.courses.find(
    (course) => course.name === "Selected semester course",
  )!;
  expect(next.current.courseSemesters[course.id]).toBe(seed.semesters[0].id);
  await expect(
    repo.execute({ ...command, semesterId: "missing" }, next.revision),
  ).rejects.toThrow();
  expect(repo.read()).toEqual(next);
});
