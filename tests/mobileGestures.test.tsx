// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import MobileGestures from "../src/components/MobileGestures";
let phone = true;
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
function touch(
  type: string,
  x: number,
  y: number,
  target: EventTarget = document.body,
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", {
    value: type === "touchend" ? [] : [{ clientX: x, clientY: y }],
  });
  target.dispatchEvent(event);
  return event;
}
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  phone = true;
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query.includes("pointer") ? phone : false;
    },
    addEventListener() {},
    removeEventListener() {},
  }));
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(<MobileGestures uid="test" language="en" />),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("pulls the page, arms refresh, and cancels without reloading", async () => {
  await act(async () => {
    touch("touchstart", 100, 0);
    touch("touchmove", 100, 230);
  });
  expect(document.querySelector(".wilo-refresh")?.textContent).toBe(
    "Release to refresh",
  );
  expect(document.documentElement.style.getPropertyValue("--wilo-pull")).toBe(
    "96.6px",
  );
  await act(async () => {
    touch("touchcancel", 100, 230);
  });
  expect(
    document.querySelector(".wilo-refresh")?.getAttribute("data-visible"),
  ).toBe("false");
});
it("does not claim desktop touch input", async () => {
  phone = false;
  await act(async () => {
    touch("touchstart", 100, 0);
    touch("touchmove", 100, 250);
  });
  expect(
    document.querySelector(".wilo-refresh")?.getAttribute("data-visible"),
  ).toBe("false");
});
it("leaves editors and open dialogs alone", async () => {
  const input = document.createElement("input");
  host.append(input);
  await act(async () => {
    touch("touchstart", 100, 0, input);
    touch("touchmove", 100, 250, input);
  });
  expect(
    document.querySelector(".wilo-refresh")?.getAttribute("data-visible"),
  ).toBe("false");
  const dialog = document.createElement("dialog");
  dialog.setAttribute("open", "");
  host.append(dialog);
  await act(async () => {
    touch("touchstart", 100, 0);
    touch("touchmove", 100, 250);
  });
  expect(
    document.querySelector(".wilo-refresh")?.getAttribute("data-visible"),
  ).toBe("false");
});
it("returns once from a deliberate left edge swipe", async () => {
  vi.spyOn(history, "length", "get").mockReturnValue(2);
  const back = vi.spyOn(history, "back").mockImplementation(() => {});
  await act(async () => {
    touch("touchstart", 5, 200);
    touch("touchmove", 110, 202);
    touch("touchend", 110, 202);
  });
  expect(back).toHaveBeenCalledTimes(1);
});
it("respects disabled motion and ignores short pulls", async () => {
  localStorage.setItem(
    "wilo-experience:v1:test",
    JSON.stringify({ motion: false }),
  );
  await act(async () => {
    touch("touchstart", 100, 0);
    touch("touchmove", 100, 50);
  });
  expect(document.documentElement.style.getPropertyValue("--wilo-pull")).toBe(
    "0px",
  );
  await act(async () => {
    touch("touchend", 100, 50);
  });
  expect(document.querySelector(".is-refreshing")).toBeNull();
});
