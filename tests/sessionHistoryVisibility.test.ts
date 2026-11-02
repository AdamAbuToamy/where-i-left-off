import { expect, it } from "vitest";
import { sessionsWithExistingCards } from "../src/lib/analytics";
import type { SessionEntry } from "../src/lib/sessionJournal";
import type { TaskEntry } from "../src/lib/taskOverview";
it("hides deleted and missing cards without deleting sessions or confusing group and personal IDs", () => {
  const sessions = [
    { id: "live", projectId: "a", groupId: "" },
    { id: "trashed", projectId: "b", groupId: "" },
    { id: "missing", projectId: "c", groupId: "" },
    { id: "group", projectId: "a", groupId: "team" },
  ] as SessionEntry[];
  const entries = [
    { project: { id: "a" } },
    { project: { id: "b", trashedAt: 1 } },
  ] as TaskEntry[];
  expect(sessionsWithExistingCards(sessions, entries).map((s) => s.id)).toEqual(
    ["live"],
  );
  expect(sessions).toHaveLength(4);
  expect(
    sessionsWithExistingCards(sessions, [
      ...entries,
      { project: { id: "a" }, groupId: "team" } as TaskEntry,
    ]).map((s) => s.id),
  ).toEqual(["live", "group"]);
  expect(
    sessionsWithExistingCards(sessions, [
      { project: { id: "b" } } as TaskEntry,
    ]).map((s) => s.id),
  ).toEqual(["trashed"]);
});
