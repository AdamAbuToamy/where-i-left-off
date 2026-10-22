// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { User } from "firebase/auth";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const reminder = vi.hoisted(() => ({ sync: vi.fn(), prepare: vi.fn() }));
vi.mock("../src/lib/firebase", () => ({
  db: { app: { options: { projectId: "demo" } } },
}));
vi.mock("../src/university/reminders", () => ({
  syncReminder: reminder.sync,
  prepareReminder: reminder.prepare,
}));
import UniversityPage from "../src/university/UniversityPage";
import { ADMIN_EMAIL } from "../src/lib/admin";
const user = {
  uid: "pilot",
  email: ADMIN_EMAIL,
  emailVerified: true,
} as User;
let root: Root, container: HTMLDivElement;
async function render(u = user) {
  await act(async () => root.render(<UniversityPage user={u} />));
}
async function click(title: string) {
  const button = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === title,
  );
  expect(button).toBeTruthy();
  await act(async () => button!.click());
}
async function submit(values: Record<string, string>) {
  const form = container.querySelector("dialog form")!;
  for (const [name, value] of Object.entries(values))
    (form.querySelector(`[name="${name}"]`) as HTMLInputElement).value = value;
  await act(async () =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
}
beforeEach(async () => {
  localStorage.clear();
  reminder.sync.mockReset();
  reminder.prepare.mockReset();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await render();
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it("creates and edits real course and task records, persists them, and never enables reminders implicitly", async () => {
  await click("+ كورس");
  await submit({ name: "Algorithms", notes: "Practice every Sunday", url: "" });
  expect(container.textContent).toContain("Algorithms");
  expect(container.textContent).toContain("Practice every Sunday");
  await click("+ وظيفة أو مهمة");
  await submit({
    title: "Exercise 1",
    due: "2026-11-10T14:30",
    notes: "Proof by induction",
    url: "",
  });
  expect(container.textContent).toContain("Exercise 1");
  const check = container.querySelector(
    ".study-task input[type=checkbox]",
  ) as HTMLInputElement;
  await act(async () => check.click());
  expect(container.querySelector(".study-task.is-done")).not.toBeNull();
  expect(reminder.sync).not.toHaveBeenCalled();
  await act(async () => root.unmount());
  root = createRoot(container);
  await render();
  expect(container.textContent).toContain("Algorithms");
  expect(container.textContent).toContain("Proof by induction");
  expect(container.querySelector(".study-task.is-done")).not.toBeNull();
});
it("keeps the pilot unavailable to another user or an unverified administrator", async () => {
  await render({
    ...user,
    uid: "other",
    email: "student@example.test",
  } as User);
  expect(container.querySelector(".study-page")).toBeNull();
  expect(container.textContent).toContain("لحساب التجربة فقط");
  await render({ ...user, emailVerified: false } as User);
  expect(container.querySelector(".study-page")).toBeNull();
});
it("stores weekly lessons with their course and rejects reversed times", async () => {
  await click("+ كورس");
  await submit({ name: "Databases", notes: "", url: "" });
  await click("מערכת שעות · الجدول");
  await click("+ محاضرة / تمرين");
  await submit({ start: "11:00", end: "10:00", room: "Building 90" });
  expect(container.textContent).toContain(
    "وقت النهاية يجب أن يكون بعد البداية",
  );
  await submit({ start: "09:00", end: "10:00", room: "Building 90" });
  expect(container.querySelector(".study-lesson")?.textContent).toContain(
    "Building 90",
  );
});
