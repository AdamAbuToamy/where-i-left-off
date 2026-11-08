import { readFileSync } from "node:fs";
import { afterAll, beforeAll, it, expect, vi } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
const runtime = vi.hoisted(() => ({
  db: null as unknown,
  auth: { currentUser: { uid: "alice" } },
  push: vi.fn(),
}));
vi.mock("../src/lib/firebase", () => ({
  get db() {
    return runtime.db;
  },
  auth: runtime.auth,
}));
vi.mock("../src/lib/pushNotifications", () => ({ pushCall: runtime.push }));
import { syncReminder } from "../src/university/reminders";
let env: RulesTestEnvironment;
const id = "r".repeat(20),
  task = {
    id: "task",
    courseId: "course",
    title: "Edited assignment",
    kind: "assignment" as const,
    due: "2026-11-18T23:59:00Z",
    done: false,
    notes: "Updated notes",
    url: "https://moodle.example/assign/1",
    reminderProjectId: id,
  };
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-reminder-persistence",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
  vi.stubGlobal("window", { dispatchEvent: () => true });
});
afterAll(async () => {
  vi.unstubAllGlobals();
  await env?.cleanup();
});
it("repairs legacy API path IDs while saving a linked task through actual client rules without broadening access", async () => {
  await env.clearFirestore();
  runtime.db = env
    .authenticatedContext("alice", { email_verified: true })
    .firestore();
  const raw = {
    id,
    name: "Imported assignment",
    nextStep: "",
    status: "active",
    kind: "deadline",
    resourceType: "course",
    dueDate: "2026-11-18",
    rank: 1,
    revision: 0,
    mutationId: "server-import",
    updatedAt: serverTimestamp(),
  };
  await env.withSecurityRulesDisabled(async (context) =>
    setDoc(doc(context.firestore(), "users/alice/projects/" + id), raw),
  );
  const ref = doc(
    runtime.db as Parameters<typeof doc>[0],
    "users/alice/projects/" + id,
  );
  await assertFails(
    updateDoc(ref, {
      name: "Still invalid",
      revision: 1,
      updatedAt: serverTimestamp(),
    }),
  );
  runtime.push.mockResolvedValue({
    preferences: { enabled: true, due: true, timezone: "UTC" },
    cards: {},
  });
  await syncReminder("alice", task);
  const saved = (await getDoc(ref)).data()!;
  expect(saved.id).toBeUndefined();
  expect(saved.name).toBe(task.title);
  expect(saved.revision).toBe(2);
  expect(saved.dueDate).toBe("2026-11-18");
  await assertFails(
    getDoc(
      doc(
        env.authenticatedContext("bob", { email_verified: true }).firestore(),
        "users/alice/projects/" + id,
      ),
    ),
  );
});
it("opens reminder configuration for a card without a due date without enrolling or enabling notifications", async () => {
  await env.clearFirestore();
  runtime.db = env
    .authenticatedContext("alice", { email_verified: true })
    .firestore();
  runtime.push.mockClear();
  runtime.push.mockResolvedValue({
    preferences: { enabled: false, due: false, timezone: "Asia/Jerusalem" },
    cards: {},
  });
  await syncReminder("alice", { ...task, due: "" }, true, { configure: true });
  const card = (
    await getDoc(
      doc(
        runtime.db as Parameters<typeof doc>[0],
        "users/alice/projects/" + id,
      ),
    )
  ).data()!;
  expect(card.dueDate).toBe("");
  expect(runtime.push).toHaveBeenCalledWith(
    expect.objectContaining({ action: "card", disabled: true }),
  );
  expect(
    runtime.push.mock.calls.some(
      ([data]) => data.action === "subscribe" || data.action === "save",
    ),
  ).toBe(false);
});
