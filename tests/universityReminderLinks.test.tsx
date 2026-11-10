// @vitest-environment jsdom
import { it, expect, vi, afterEach } from "vitest";
import { createRoot } from "react-dom/client";
import { act } from "react";
import type { User } from "firebase/auth";
const m = vi.hoisted(() => ({
  uid: "alice",
  streams: [] as {
    receive: (snapshot: unknown) => void;
    fail: () => void;
    stop: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock("../src/lib/firebase", () => ({
  db: { app: { options: { projectId: "test" } } },
  auth: {
    get currentUser() {
      return { uid: m.uid };
    },
  },
}));
vi.mock("firebase/firestore", () => ({
  collection: () => ({}),
  where: () => ({}),
  query: () => ({}),
  onSnapshot: (
    _q: unknown,
    _o: unknown,
    receive: (s: unknown) => void,
    fail: () => void,
  ) => {
    const stop = vi.fn();
    m.streams.push({ receive, fail, stop });
    return stop;
  },
}));
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
import { useUniversityReminderLinks } from "../src/university/useUniversityReminderLinks";
const node = document.createElement("div");
document.body.append(node);
let root = createRoot(node);
function Probe({ uid, enabled = true }: { uid: string; enabled?: boolean }) {
  const index = useUniversityReminderLinks(
    { uid, emailVerified: true } as User,
    enabled,
  );
  return (
    <pre>
      {JSON.stringify({
        ids: [...index.ids],
        ready: index.ready,
        failed: index.failed,
      })}
    </pre>
  );
}
const snapshot = (id: string) => ({
  metadata: { fromCache: false },
  docs: [
    {
      data: () => ({
        kind: "tasks",
        id: "task",
        deleted: false,
        payload: JSON.stringify({ id: "task", reminderProjectId: id }),
      }),
    },
  ],
});
afterEach(async () => {
  await act(async () => root.unmount());
  root = createRoot(node);
  m.streams = [];
  m.uid = "alice";
  localStorage.clear();
});
it("keeps the index account scoped and ignores late callbacks after account changes", async () => {
  await act(async () => root.render(<Probe uid="alice" />));
  expect(node.textContent).toContain('"ready":false');
  await act(async () => m.streams[0].receive(snapshot("a".repeat(20))));
  expect(node.textContent).toContain("a".repeat(20));
  m.uid = "bob";
  await act(async () => root.render(<Probe uid="bob" />));
  expect(node.textContent).not.toContain("a".repeat(20));
  expect(m.streams[0].stop).toHaveBeenCalled();
  await act(async () => m.streams[0].receive(snapshot("a".repeat(20))));
  expect(node.textContent).not.toContain("a".repeat(20));
  await act(async () => m.streams[1].receive(snapshot("b".repeat(20))));
  expect(node.textContent).toContain("b".repeat(20));
});
it("does not subscribe for notification-infrastructure or group-only consumers", async () => {
  await act(async () => root.render(<Probe uid="alice" enabled={false} />));
  expect(m.streams).toHaveLength(0);
  expect(node.textContent).toContain('"ready":true');
});
it("does not claim a verified personal-card list after a failed index read", async () => {
  await act(async () => root.render(<Probe uid="alice" />));
  await act(async () => m.streams[0].fail());
  expect(node.textContent).toContain('"failed":true');
  expect(node.textContent).toContain('"ready":false');
});

it("retains pending offline task links while a fresh server snapshot is still catching up", async () => {
  localStorage.setItem(
    "wilo-university-v1/test/alice/sync",
    JSON.stringify({
      pending: [
        [
          "tasks_task",
          {
            record: {
              kind: "tasks",
              id: "task",
              deleted: false,
              payload: JSON.stringify({
                id: "task",
                reminderProjectId: "a".repeat(20),
              }),
            },
          },
        ],
      ],
    }),
  );
  await act(async () => root.render(<Probe uid="alice" />));
  await act(async () =>
    m.streams[0].receive({ metadata: { fromCache: false }, docs: [] }),
  );
  expect(node.textContent).toContain("a".repeat(20));
  expect(node.textContent).toContain('"ready":true');
});
