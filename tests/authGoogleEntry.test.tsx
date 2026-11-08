// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
const fake = vi.hoisted(() => ({
  auth: { currentUser: null as object | null },
  popup: vi.fn(),
  info: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("../src/lib/firebase", () => ({ auth: fake.auth }));
vi.mock("../src/lib/logging", () => ({
  traced: (_name: string, action: () => Promise<unknown>) => action(),
}));
vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: fake.popup,
  getAdditionalUserInfo: fake.info,
  signOut: fake.logout,
  createUserWithEmailAndPassword: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  updateProfile: vi.fn(),
}));
import AuthPanel from "../src/components/AuthPanel";
import {
  authEntryHeld,
  finishAuthEntry,
  takeAuthArrival,
} from "../src/lib/authEntry";
import type { User } from "firebase/auth";
let element: HTMLDivElement, root: Root;
const user = {
  uid: "google-entry-user",
  metadata: {},
  emailVerified: true,
} as User;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  finishAuthEntry(user);
  fake.auth.currentUser = null;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
});
afterEach(() => {
  act(() => root.unmount());
  element.remove();
  finishAuthEntry(user);
  vi.unstubAllGlobals();
});
function google() {
  return Array.from(element.querySelectorAll("button")).find(
    (button) => button.textContent === "Continue with Google",
  )!;
}
function render() {
  act(() => root.render(<AuthPanel language="en" />));
}
it("existing Google sign-in opens the provider immediately and never asks for age", async () => {
  fake.info.mockReturnValue({ isNewUser: false });
  fake.popup.mockImplementation(async () => {
    fake.auth.currentUser = user;
    return { user };
  });
  render();
  expect(element.querySelector(".auth-age-group")).toBeNull();
  await act(async () => google().click());
  expect(fake.popup).toHaveBeenCalledTimes(1);
  expect(element.querySelector(".auth-age-group")).toBeNull();
  expect(authEntryHeld(user)).toBe(false);
  expect(takeAuthArrival(user.uid)).toBe(true);
});
it("only a new Google account asks after provider authentication and stays gated until confirmation", async () => {
  fake.info.mockReturnValue({ isNewUser: true });
  fake.popup.mockImplementation(async () => {
    fake.auth.currentUser = user;
    return { user };
  });
  render();
  await act(async () => google().click());
  expect(element.querySelector(".auth-age-group")).not.toBeNull();
  expect(authEntryHeld(user)).toBe(true);
  const select = element.querySelector("select")!;
  await act(async () => {
    select.value = "under16";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  expect(
    (element.querySelector("button.primary-button") as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(authEntryHeld(user)).toBe(true);
  await act(async () => {
    select.value = "16plus";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () =>
    element
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  expect(authEntryHeld(user)).toBe(false);
  expect(localStorage.getItem("wilo-google-registration-pending")).toBeNull();
});
it("unfinished Google setup survives a reload without storing age or allowing a provider error to hold ordinary sign-in", async () => {
  localStorage.setItem("wilo-google-registration-pending", user.uid);
  fake.auth.currentUser = user;
  render();
  expect(element.querySelector(".auth-age-group")).not.toBeNull();
  expect(authEntryHeld(user)).toBe(true);
  expect(localStorage.getItem("wilo-google-registration-pending")).toBe(
    user.uid,
  );
});
it("a cancelled provider popup releases the presentation hold and remains retryable", async () => {
  fake.popup.mockRejectedValue(new Error("popup closed"));
  render();
  await act(async () => google().click());
  expect(authEntryHeld(null)).toBe(false);
  expect(element.querySelector("[role=alert]")).not.toBeNull();
  expect((google() as HTMLButtonElement).disabled).toBe(false);
});
