// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  applyColorMode,
  observeColorMode,
  readColorMode,
  saveColorMode,
} from "../src/lib/colorMode";
afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});
it("preserves per-account choices, updates the first-paint preference and applies explicit modes", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  saveColorMode("alice", "light");
  expect(readColorMode("alice")).toBe("light");
  expect(readColorMode("bob")).toBe("system");
  expect(localStorage.getItem("site-color-mode")).toBe("light");
  expect(document.documentElement.dataset.colorScheme).toBe("light");
  applyColorMode("system");
  expect(document.documentElement.dataset.colorScheme).toBe("dark");
});
it("tracks OS changes only in system mode and removes listeners", () => {
  let dark = false;
  let notify = () => {};
  const removed = vi.fn();
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return dark;
    },
    addEventListener: (_type: string, fn: () => void) => {
      notify = fn;
    },
    removeEventListener: removed,
  }));
  const stop = observeColorMode("test");
  dark = true;
  notify();
  expect(document.documentElement.dataset.colorScheme).toBe("dark");
  saveColorMode("test", "light");
  notify();
  expect(document.documentElement.dataset.colorScheme).toBe("light");
  stop();
  expect(removed).toHaveBeenCalled();
});
