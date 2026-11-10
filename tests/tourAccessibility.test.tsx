// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { computeAccessibleName } from "dom-accessibility-api";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { User } from "firebase/auth";
const mock = vi.hoisted(() => ({
  discard: vi.fn(),
  snapshot: { projects: [], queued: 0 },
  ready: true,
}));
vi.mock("../src/lib/firebase", () => ({
  db: { app: { options: { projectId: "demo" } } },
}));
vi.mock("../src/components/useJourneyWorkspace", () => ({
  useJourneyWorkspace: () => mock,
}));
import WelcomeTour from "../src/components/WelcomeTour";
import { journeyText } from "../src/components/journeyText";
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
const user = {
  uid: "new-user",
  metadata: { creationTime: new Date().toUTCString() },
} as User;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  history.replaceState({}, "", location.pathname + "#/personal");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("CSS", { escape: (v: string) => v });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  mock.discard.mockReset();
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
it.each(["ar", "en", "he"] as const)(
  "offers an accessible opt-out before writes in %s",
  (language) => {
    act(() => root.render(<WelcomeTour user={user} language={language} />));
    const skip = document.querySelector<HTMLButtonElement>(".guide-skip")!;
    expect(computeAccessibleName(skip)).toBe(journeyText[language].skip);
    act(() => skip.click());
    expect(document.querySelector("dialog[open]")).toBeNull();
    expect(localStorage.getItem("welcome-tour:v2:new-user")).toBe("done");
    expect(mock.discard).not.toHaveBeenCalled();
  },
);
it("waits for a real account-scoped creation receipt, and asks before discarding", async () => {
  act(() => root.render(<WelcomeTour user={user} language="en" />));
  act(() =>
    document
      .querySelector<HTMLButtonElement>(".journey-welcome .primary-button")!
      .click(),
  );
  expect(
    document.querySelector(".journey-layer")?.getAttribute("data-tour-step"),
  ).toBe("create");
  act(() =>
    window.dispatchEvent(
      new CustomEvent("tour-project-created", {
        detail: { uid: "other", id: "not-mine" },
      }),
    ),
  );
  expect(
    document.querySelector(".journey-layer")?.getAttribute("data-tour-step"),
  ).toBe("create");
  act(() =>
    window.dispatchEvent(
      new CustomEvent("tour-project-created", {
        detail: { uid: user.uid, id: "created-here" },
      }),
    ),
  );
  expect(
    document.querySelector(".journey-layer")?.getAttribute("data-tour-step"),
  ).toBe("card");
  act(() =>
    document.querySelector<HTMLButtonElement>(".journey-stop")!.click(),
  );
  expect(mock.discard).not.toHaveBeenCalled();
  await act(async () =>
    document.querySelector<HTMLButtonElement>(".journey-remove")!.click(),
  );
  expect(mock.discard).toHaveBeenCalledWith(["created-here"]);
  expect(sessionStorage.getItem("welcome-journey:v1:demo/new-user")).toBeNull();
});
it("does not interrupt extension capture and defers replay until drafts close", async () => {
  history.replaceState({}, "", location.pathname + "?capture=tab#/personal");
  act(() => root.render(<WelcomeTour user={user} language="en" />));
  expect(document.querySelector("dialog")).toBeNull();
  const editor = document.createElement("div");
  editor.className = "phone-form-fullscreen";
  document.body.append(editor);
  act(() => window.dispatchEvent(new Event("replay-welcome-tour")));
  expect(document.querySelector("dialog")).toBeNull();
  await act(async () => {
    editor.remove();
    await Promise.resolve();
  });
  expect(document.querySelector("dialog[open]")).not.toBeNull();
});
it("retains receipts after cleanup failure rather than silently finishing", async () => {
  sessionStorage.setItem(
    "welcome-journey:v1:demo/new-user",
    JSON.stringify({ step: "finish", ids: ["created-here"] }),
  );
  mock.discard.mockRejectedValue(new Error("conflict"));
  act(() => root.render(<WelcomeTour user={user} language="en" />));
  await act(async () =>
    document.querySelector<HTMLButtonElement>(".journey-remove")!.click(),
  );
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "didn't finish",
  );
  expect(sessionStorage.getItem("welcome-journey:v1:demo/new-user")).toContain(
    "created-here",
  );
  expect(localStorage.getItem("welcome-tour:v2:new-user")).toBeNull();
});
