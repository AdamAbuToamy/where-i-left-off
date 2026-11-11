// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ContextualCompanion from "../src/companion/ContextualCompanion";
import CompanionSettings from "../src/companion/CompanionSettings";
import { companionFeedEvent } from "../src/companion/feed";
import {
  readCompanionState,
  refreshCompanionState,
  saveCompanionPreferences,
  recordCompanionVisit,
  companionStorageKey,
} from "../src/companion/preferences";
let host: HTMLDivElement, root: ReturnType<typeof createRoot>;
const uid = "companion-test-alice";
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  vi.setSystemTime(new Date("2026-11-11T10:00:00Z"));
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  localStorage.clear();
  refreshCompanionState(uid);
  refreshCompanionState("companion-test-bob");
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  vi.stubGlobal("CSS", { escape: (value: string) => value });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }));
  host = document.createElement("div");
  host.className = "private-content";
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("uses only its own feed, renders untrusted titles as text, and immediately disappears when disabled", async () => {
  const prefs = {
    ...readCompanionState(uid).preferences,
    features: false,
    extension: false,
  };
  saveCompanionPreferences(uid, prefs);
  await act(async () =>
    root.render(
      <ContextualCompanion uid={uid} page="personal" language="en" />,
    ),
  );
  const items = [
    {
      kind: "task",
      id: "task-a",
      courseId: "course-a",
      title: "<img src=x> Synthetic task",
      dueAt: Date.now() + 86400000,
    },
  ];
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent(companionFeedEvent, {
        detail: { uid: "companion-test-bob", scope: "university", items },
      }),
    );
    await vi.advanceTimersByTimeAsync(35000);
  });
  expect(host.querySelector(".context-companion")).toBeNull();
  await act(async () => {
    window.dispatchEvent(
      new CustomEvent(companionFeedEvent, {
        detail: { uid, scope: "university", items },
      }),
    );
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(host.querySelector(".context-companion")?.textContent).toContain(
    "<img src=x> Synthetic task",
  );
  expect(host.querySelector("img")).toBeNull();
  expect(localStorage.getItem(companionStorageKey(uid))).not.toContain(
    "Synthetic task",
  );
  await act(async () =>
    saveCompanionPreferences(uid, { ...prefs, enabled: false }),
  );
  expect(host.querySelector(".context-companion")).toBeNull();
  await act(async () => vi.advanceTimersByTimeAsync(86400000));
  expect(host.querySelector(".context-companion")).toBeNull();
});
it("settings opt-out is per account and remains saved", async () => {
  await act(async () =>
    root.render(<CompanionSettings uid={uid} language="en" />),
  );
  const master = host.querySelector<HTMLInputElement>("input[type=checkbox]")!;
  await act(async () => master.click());
  expect(readCompanionState(uid).preferences.enabled).toBe(false);
  expect(readCompanionState("companion-test-bob").preferences.enabled).toBe(
    true,
  );
  refreshCompanionState(uid);
  expect(readCompanionState(uid).preferences.enabled).toBe(false);
  recordCompanionVisit(uid, "card:ignored");
  expect(readCompanionState(uid).visits).toEqual({});
  expect(host.querySelector("fieldset")?.disabled).toBe(true);
});
it("does not interrupt writing, respects the private-content boundary and pauses for a day", async () => {
  saveCompanionPreferences(uid, {
    ...readCompanionState(uid).preferences,
    extension: false,
  });
  await act(async () =>
    root.render(
      <>
        <input aria-label="writing" />
        <ContextualCompanion uid={uid} page="personal" language="ar" />
      </>,
    ),
  );
  const input = host.querySelector("input")!;
  await act(async () => {
    input.focus();
    await vi.advanceTimersByTimeAsync(35000);
  });
  expect(host.querySelector(".context-companion")).toBeNull();
  await act(async () => {
    input.blur();
    await vi.advanceTimersByTimeAsync(5000);
  });
  expect(host.querySelector(".context-companion")).not.toBeNull();
  expect(
    host.querySelector(".context-companion")?.closest(".private-content"),
  ).toBe(host);
  const pause = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "إخفاء ليوم",
  )!;
  await act(async () => pause.click());
  expect(host.querySelector(".context-companion")).toBeNull();
  expect(readCompanionState(uid).pausedUntil).toBeGreaterThan(Date.now());
});

it("keeps opt-out effective in memory and reports a storage failure", async () => {
  await act(async () =>
    root.render(<CompanionSettings uid={uid} language="en" />),
  );
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("storage-full");
  });
  await act(async () =>
    host.querySelector<HTMLInputElement>("input[type=checkbox]")!.click(),
  );
  expect(readCompanionState(uid).preferences.enabled).toBe(false);
  expect(host.querySelector("[role=alert]")?.textContent).toContain(
    "Could not save",
  );
});
