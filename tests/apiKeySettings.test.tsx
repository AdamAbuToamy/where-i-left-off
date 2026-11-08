// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import type { User } from "firebase/auth";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const call = vi.hoisted(() => vi.fn());
vi.mock("../src/lib/apiKeys", () => ({ accountApiKeys: call }));
import ApiKeySettings from "../src/components/ApiKeySettings";
let container: HTMLDivElement, root: Root;
const user = { uid: "alice" } as User;
const secret = "synthetic-display-only";
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  call
    .mockReset()
    .mockImplementation(async (_user: User, data: { action: string }) =>
      data.action === "create"
        ? { key: secret, metadata: { id: "key" } }
        : { keys: [] },
    );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () =>
    root.render(<ApiKeySettings user={user} language="en" />),
  );
}
async function issue() {
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
it("shows the secret once, copies only on tap, and destroys it on close; never uses browser storage", async () => {
  const copy = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: copy },
  });
  const storage = vi.spyOn(Storage.prototype, "setItem");
  await render();
  await issue();
  expect(container.querySelector("textarea")?.value).toBe(secret);
  expect(container.querySelector("dialog")?.open).toBe(true);
  expect(copy).not.toHaveBeenCalled();
  await act(async () => {
    [...container.querySelectorAll("button")]
      .find((b) => b.textContent === "Copy key")!
      .click();
  });
  expect(copy).toHaveBeenCalledWith(secret);
  act(() => {
    [...container.querySelectorAll("button")]
      .find((b) => b.textContent?.startsWith("I saved"))!
      .click();
  });
  expect(container.querySelector("textarea")).toBeNull();
  expect(container.textContent).not.toContain(secret);
  expect(storage).not.toHaveBeenCalled();
  storage.mockRestore();
});
it("does not retain the secret after unmount and returning to settings", async () => {
  await render();
  await issue();
  act(() => root.unmount());
  root = createRoot(container);
  await render();
  expect(container.querySelector("textarea")).toBeNull();
  expect(container.textContent).not.toContain(secret);
});
it("reports management failure without showing payload or credentials", async () => {
  call.mockRejectedValue(Error(secret));
  await render();
  expect(container.querySelector("[role=alert]")).not.toBeNull();
  expect(container.textContent).not.toContain(secret);
});
it("discards a creation response arriving after the tab was hidden", async () => {
  let resolve!: (value: { key: string }) => void;
  await render();
  call.mockImplementation(async (_user: User, data: { action: string }) =>
    data.action === "create"
      ? new Promise<{ key: string }>((done) => { resolve = done; })
      : { keys: [] },
  );
  await issue();
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  try {
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    await act(async () => resolve({ key: secret }));
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.textContent).not.toContain(secret);
    expect(container.querySelector("[role=alert]")).not.toBeNull();
  } finally {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  }
});
