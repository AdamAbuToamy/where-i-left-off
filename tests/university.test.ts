import { describe, it, expect, vi } from "vitest";
import {
  emptyUniversity,
  mergeSnapshot,
  parseSnapshot,
  toLocalInput,
  UniversityStore,
  validateCourse,
} from "../src/university/model";
const snapshot = () => ({
  format: "wilo-bgu-moodle-v1",
  exportedAt: "2026-10-22T10:00:00Z",
  courses: [
    {
      id: "42",
      name: "Algorithms",
      url: "https://moodle.bgu.ac.il/moodle/course/view.php?id=42",
    },
  ],
  events: [
    {
      id: "91",
      courseId: "42",
      title: "Assignment 1",
      kind: "assignment",
      due: "2026-11-02T10:00:00Z",
      url: "https://moodle.bgu.ac.il/moodle/mod/assign/view.php?id=9",
    },
  ],
  warnings: [],
});
describe("university import and local study data", () => {
  it("rejects links that expose login/session values or leave the university", () => {
    for (const url of [
      "javascript:alert(1)",
      "https://example.test/",
      "https://moodle.bgu.ac.il.evil.test/moodle/",
      "https://moodle.bgu.ac.il/moodle/course/view.php?sesskey=SECRET",
    ]) {
      const value = snapshot();
      value.courses[0].url = url;
      expect(() => parseSnapshot(value)).toThrow();
    }
  });
  it("whitelists course fields so session material cannot enter the saved snapshot", () => {
    const value = snapshot();
    Object.assign(value, { sesskey: "PRIVATE", cookie: "SECRET" });
    Object.assign(value.courses[0], { token: "PRIVATE" });
    expect(JSON.stringify(parseSnapshot(value))).not.toMatch(
      /PRIVATE|SECRET|sesskey/,
    );
  });
  it("merges repeated Moodle exports without duplicate tasks or loss of edits", () => {
    const first = mergeSnapshot(emptyUniversity(), parseSnapshot(snapshot()));
    first.courses[0].notes = "My notes";
    first.tasks[0].done = true;
    first.tasks[0].title = "Edited title";
    first.tasks[0].notes = "My solution";
    first.tasks[0].reminderProjectId = "a".repeat(20);
    const source = snapshot();
    source.events[0].title = "Updated Moodle title";
    source.events[0].due = "2026-11-03T11:00:00Z";
    const merged = mergeSnapshot(first, parseSnapshot(source));
    expect(merged.courses).toHaveLength(1);
    expect(merged.tasks).toHaveLength(1);
    expect(merged.courses[0].notes).toBe("My notes");
    expect(merged.tasks[0]).toMatchObject({
      title: "Edited title",
      done: true,
      notes: "My solution",
      reminderProjectId: "a".repeat(20),
      due: "2026-11-03T11:00:00.000Z",
    });
    const next = mergeSnapshot(merged, parseSnapshot(source));
    expect(next).toEqual(merged);
  });
  it("preserves a manually changed deadline and does not delete records missing from a partial export", () => {
    const state = mergeSnapshot(emptyUniversity(), parseSnapshot(snapshot()));
    state.tasks[0].due = "2026-12-01T12:00:00Z";
    const source = snapshot();
    source.events[0].due = "2026-11-03T11:00:00Z";
    expect(mergeSnapshot(state, parseSnapshot(source)).tasks[0].due).toBe(
      state.tasks[0].due,
    );
    source.events = [];
    expect(mergeSnapshot(state, parseSnapshot(source)).tasks).toHaveLength(1);
  });
  it("rejects inconsistent event data and cyclic prerequisites", () => {
    const bad = snapshot();
    bad.events[0].courseId = "999";
    expect(() => parseSnapshot(bad)).toThrow();
    bad.events[0].courseId = "42";
    bad.events[0].due = "invalid";
    expect(() => parseSnapshot(bad)).toThrow();
    const a = {
        id: "a",
        name: "A",
        url: "",
        notes: "",
        requires: ["b"],
        x: 0,
        y: 0,
      },
      b = { ...a, id: "b", name: "B", requires: ["a"] };
    expect(() => validateCourse(a, [a, b])).toThrow("حلقة");
  });
  it("scopes local records to both user and Firebase project", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => data.get(k) || null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
    try {
      const a = new UniversityStore("alice", "production");
      a.save(mergeSnapshot(emptyUniversity(), parseSnapshot(snapshot())));
      expect(a.load().courses).toHaveLength(1);
      expect(
        new UniversityStore("bob", "production").load().courses,
      ).toHaveLength(0);
      expect(
        new UniversityStore("alice", "emulator").load().courses,
      ).toHaveLength(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("formats dates for datetime-local with the actual local hour", () => {
    const d = new Date("2026-10-22T10:00:00Z"),
      s = toLocalInput(d.toISOString());
    expect(s.slice(11, 13)).toBe(String(d.getHours()).padStart(2, "0"));
  });
});
