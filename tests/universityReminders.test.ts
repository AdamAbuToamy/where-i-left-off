import { beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  records: new Map<string, Record<string, unknown>>(),
  push: vi.fn(),
  uid: "alice",
}));
vi.mock("../src/lib/firebase", () => ({
  db: {},
  auth: {
    get currentUser() {
      return { uid: m.uid };
    },
  },
}));
vi.mock("../src/lib/pushNotifications", () => ({ pushCall: m.push }));
vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  doc: (_db: unknown, ...args: string[]) => ({
    id: args.at(-1) || "a".repeat(20),
  }),
  serverTimestamp: () => 1,
  runTransaction: async (
    _db: unknown,
    callback: (tx: unknown) => Promise<void>,
  ) =>
    callback({
      get: async (ref: { id: string }) => ({
        exists: () => m.records.has(ref.id),
        data: () => m.records.get(ref.id),
      }),
      set: (ref: { id: string }, data: Record<string, unknown>) =>
        m.records.set(ref.id, { ...data }),
      update: (ref: { id: string }, data: Record<string, unknown>) =>
        m.records.set(ref.id, { ...m.records.get(ref.id), ...data }),
    }),
}));
import { syncReminder } from "../src/university/reminders";
import type { StudyTask } from "../src/university/model";
const task: StudyTask = {
  id: "task",
  courseId: "42",
  title: "Assignment 1",
  kind: "assignment",
  due: "2026-11-10T10:30:00Z",
  done: false,
  notes: "Work",
  url: "",
  reminderProjectId: "a".repeat(20),
};
beforeEach(() => {
  m.records.clear();
  m.uid = "alice";
  m.push.mockReset();
  m.push.mockResolvedValue({
    preferences: {
      enabled: true,
      due: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  vi.stubGlobal("window", { dispatchEvent: () => {} });
});
it("refuses cross-account access and creation without reminder consent", async () => {
  await expect(syncReminder("bob", task, true)).rejects.toThrow("سجّل الدخول");
  expect(m.records.size).toBe(0);
  m.push.mockResolvedValue({
    preferences: {
      enabled: false,
      due: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  await expect(syncReminder("alice", task, true)).rejects.toThrow("فعّل");
  expect(m.records.size).toBe(0);
});
it("publishes the exact date only after reminder configuration succeeds; retry does not duplicate a card", async () => {
  m.push.mockImplementation(async (data) => {
    if (data.action === "card") {
      expect(m.records.get(task.reminderProjectId!)?.dueDate).toBe("");
      throw new Error("unavailable");
    }
    return {
      preferences: {
        enabled: true,
        due: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  });
  await expect(syncReminder("alice", task, true)).rejects.toThrow(
    "unavailable",
  );
  expect(m.records.size).toBe(1);
  expect(m.records.get(task.reminderProjectId!)?.dueDate).toBe("");
  m.push.mockResolvedValue({
    preferences: {
      enabled: true,
      due: true,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  await syncReminder("alice", task, true);
  expect(m.records.size).toBe(1);
  expect(m.records.get(task.reminderProjectId!)?.dueDate).toMatch(
    /^2026-11-10$/,
  );
  await syncReminder("alice", { ...task, done: true });
  expect(m.records.get(task.reminderProjectId!)?.status).toBe("done");
  expect(m.push).toHaveBeenCalledWith(
    expect.objectContaining({ action: "card", disabled: true }),
  );
});
it("does not resurrect a reminder card that the user deleted", async () => {
  const result = await syncReminder("alice", task);
  expect(result.reminderProjectId).toBeUndefined();
  expect(m.records.size).toBe(0);
  expect(m.push.mock.calls.some(([d]) => d.action === "card")).toBe(false);
});
