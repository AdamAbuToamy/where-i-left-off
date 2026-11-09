// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { User } from "firebase/auth";
const audio = vi.hoisted(() => ({ cancel: vi.fn(), dispose: vi.fn() }));
vi.mock("../src/experience/entryAudio", () => ({
  cancelEntryAudio: audio.cancel,
}));
vi.mock("../src/experience/interactionAudio", () => ({
  InteractionAudio: class {
    dispose = audio.dispose;
    play = vi.fn();
  },
}));
vi.mock("../src/experience/ArrivalScene", () => ({
  default: () => <div data-testid="arrival" />,
}));
import CinematicExperience from "../src/experience/CinematicExperience";
import { finishAuthEntry } from "../src/lib/authEntry";
const user = {
  uid: "ordinary-user",
  email: "ordinary@example.test",
  emailVerified: true,
} as User;
let node: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  node = document.createElement("div");
  document.body.append(node);
  root = createRoot(node);
});
afterEach(() => {
  act(() => root.unmount());
  node.remove();
  finishAuthEntry(null);
  vi.unstubAllGlobals();
});
it("ordinary authenticated sign-in shows the same published arrival and transitions", () => {
  finishAuthEntry(user, true);
  act(() => root.render(<CinematicExperience user={user} language="en" />));
  expect(node.querySelector('[data-testid="arrival"]')).not.toBeNull();
  expect(document.documentElement.dataset.cinematic).toBe("on");
});
it("restored sessions do not replay the arrival", () => {
  finishAuthEntry(user);
  act(() => root.render(<CinematicExperience user={user} language="en" />));
  expect(node.querySelector('[data-testid="arrival"]')).toBeNull();
});
it("the ordinary user's saved motion/sound opt-out is respected", () => {
  localStorage.setItem(
    "wilo-experience:v1:" + user.uid,
    JSON.stringify({ motion: false, sound: false }),
  );
  finishAuthEntry(user, true);
  act(() => root.render(<CinematicExperience user={user} language="en" />));
  expect(node.querySelector('[data-testid="arrival"]')).toBeNull();
  expect(document.documentElement.dataset.cinematic).toBe("off");
  expect(audio.cancel).toHaveBeenCalled();
});
it("reduced-motion prevents the arrival for every role", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  finishAuthEntry(user, true);
  act(() => root.render(<CinematicExperience user={user} language="en" />));
  expect(node.querySelector('[data-testid="arrival"]')).toBeNull();
});
