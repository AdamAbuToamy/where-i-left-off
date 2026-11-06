// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { computeAccessibleName } from "dom-accessibility-api";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import WelcomeTour from "../src/components/WelcomeTour";
import { tourText } from "../src/tourText";
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  history.replaceState({}, "", location.pathname + "#/personal");
  localStorage.clear();
  location.hash = "#/personal";
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
it.each(["ar", "en", "he"] as const)(
  "tour close button has the exact translated name and dismisses in %s",
  (language) => {
    const user = {
      uid: "new-user",
      metadata: { creationTime: new Date().toUTCString() },
    } as User;
    act(() => root.render(<WelcomeTour user={user} language={language} />));
    const button = document.querySelector<HTMLButtonElement>(".guide-skip")!;
    expect(button).not.toBeNull();
    expect(computeAccessibleName(button)).toBe(tourText[language].skip);
    act(() => button.click());
    expect(document.querySelector(".welcome-guide")).toBeNull();
    expect(localStorage.getItem("welcome-tour:v2:new-user")).toBe("done");
    act(() => window.dispatchEvent(new Event("replay-welcome-tour")));
    expect(document.querySelector(".welcome-guide")).not.toBeNull();
  },
);

it("isolates the explanation, restores the app on Escape and never requires creating data", () => {
  const user = {
    uid: "keyboard-user",
    metadata: { creationTime: new Date().toUTCString() },
  } as User;
  act(() => root.render(<WelcomeTour user={user} language="en" />));
  expect(container.hasAttribute("inert")).toBe(true);
  expect(
    document.querySelector(".tour-popover")?.getAttribute("aria-modal"),
  ).toBe("true");
  expect(
    document.querySelector<HTMLButtonElement>(".tour-next")?.disabled,
  ).toBe(false);
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  expect(document.querySelector(".tour-layer")).toBeNull();
  expect(container.hasAttribute("inert")).toBe(false);
  expect(localStorage.getItem("welcome-tour:v2:keyboard-user")).toBe("done");
});

it("defers a replay until an open editor closes rather than discarding its draft", async () => {
  const user = {
    uid: "existing",
    metadata: { creationTime: new Date(Date.now() - 172800000).toUTCString() },
  } as User;
  act(() => root.render(<WelcomeTour user={user} language="en" />));
  const editor = document.createElement("div");
  editor.id = "new-project-panel";
  editor.className = "is-open";
  document.body.append(editor);
  act(() => window.dispatchEvent(new Event("replay-welcome-tour")));
  expect(document.querySelector(".tour-layer")).toBeNull();
  await act(async () => {
    editor.remove();
    await Promise.resolve();
  });
  expect(document.querySelector(".tour-layer")).not.toBeNull();
});
it("leaves extension captures uninterrupted until a tour is explicitly requested", () => {
  history.replaceState({}, "", location.pathname + "?capture=tab#/personal");
  const user = {
    uid: "capturing",
    metadata: { creationTime: new Date().toUTCString() },
  } as User;
  act(() => root.render(<WelcomeTour user={user} language="en" />));
  expect(document.querySelector(".tour-layer")).toBeNull();
  history.replaceState({}, "", location.pathname + "#/personal");
});
