// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { Language } from "../src/translations";
const api = vi.hoisted(() => ({
  auth: { currentUser: null as { uid: string } | null },
  create: vi.fn(),
  signIn: vi.fn(),
  google: vi.fn(),
  profile: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: api.create,
  signInWithEmailAndPassword: api.signIn,
  signInWithPopup: api.google,
  updateProfile: api.profile,
  sendPasswordResetEmail: api.reset,
  GoogleAuthProvider: class {},
  getAdditionalUserInfo: () => ({ isNewUser: true }),
  signOut: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/lib/firebase", () => ({ auth: api.auth }));
vi.mock("../src/lib/logging", () => ({
  traced: async (_name: string, action: () => Promise<unknown>) => action(),
}));
import AuthPanel from "../src/components/AuthPanel";
import { authEntryHeld, finishAuthEntry } from "../src/lib/authEntry";
import type { User } from "firebase/auth";
import { registrationEligible } from "../src/lib/registrationEligibility";
import { registrationText } from "../src/components/registrationText";
let element: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  api.auth.currentUser = null;
  api.create.mockImplementation(async () => {
    api.auth.currentUser = { uid: "new-user" };
    return { user: api.auth.currentUser };
  });
  api.profile.mockResolvedValue(undefined);
  api.signIn.mockImplementation(async () => {
    api.auth.currentUser = { uid: "existing" };
    return { user: api.auth.currentUser };
  });
  api.google.mockImplementation(async () => {
    api.auth.currentUser = { uid: "google" };
    return { user: api.auth.currentUser };
  });
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  finishAuthEntry(api.auth.currentUser as User | null);
});
async function render(language: Language = "en") {
  await act(async () => root.render(<AuthPanel language={language} />));
}
async function click(selector: string) {
  const button = element.querySelector<HTMLButtonElement>(selector)!;
  await act(async () => button.click());
}
async function age(value: string) {
  const select = element.querySelector<HTMLSelectElement>(
    '[aria-label="Age group"]',
  )!;
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function field(id: string, value: string) {
  const input = element.querySelector<HTMLInputElement>("#" + id)!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function submit() {
  await act(async () => {
    element
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
it("accepts only an explicit eligible band, not truthy or untrusted values", () => {
  for (const value of ["", undefined, 16, "under16", true, {}, "adult"])
    expect(registrationEligible(value)).toBe(false);
  expect(registrationEligible("16plus")).toBe(true);
});
async function accountDetails() {
  await field("email", "person@example.test");
  await submit();
  expect(api.create).not.toHaveBeenCalled();
  await field("password", "Test-password");
  await submit();
  expect(api.create).not.toHaveBeenCalled();
}
it("does not create an account until the final eligibility step is explicitly completed", async () => {
  await render();
  await click(".auth-journey-switch button");
  expect(element.querySelector("#email")).not.toBeNull();
  expect(element.querySelector("select")).toBeNull();
  await accountDetails();
  await field("name", "Name");
  await submit();
  expect(api.create).not.toHaveBeenCalled();
  await age("under16");
  await submit();
  expect(api.create).not.toHaveBeenCalled();
  expect(
    (element.querySelector(".auth-continue") as HTMLButtonElement).disabled,
  ).toBe(true);
  expect(element.textContent).toContain("New accounts are available");
});
it("registers an eligible person and never stores an age or DOB", async () => {
  await render();
  await click(".auth-journey-switch button");
  await accountDetails();
  await field("name", "Name");
  await age("16plus");
  await submit();
  expect(api.create).toHaveBeenCalledWith(
    api.auth,
    "person@example.test",
    "Test-password",
  );
  expect(api.profile).toHaveBeenCalledWith(
    { uid: "new-user" },
    { displayName: "Name" },
  );
  expect(localStorage.length).toBe(0);
  expect(sessionStorage.length).toBe(0);
});
it("preserves existing email sign-in without age or DOB collection", async () => {
  await render();
  await field("email", "existing@example.test");
  await submit();
  await field("password", "Existing-password");
  await submit();
  expect(api.signIn).toHaveBeenCalledTimes(1);
  expect(api.create).not.toHaveBeenCalled();
  expect(element.querySelector('[aria-label="Age group"]')).toBeNull();
});
it("Google opens immediately but new-account entry remains gated until eligibility", async () => {
  await render();
  await click(".auth-journey-switch button");
  await click(".auth-google");
  expect(api.google).toHaveBeenCalledTimes(1);
  expect(authEntryHeld(api.auth.currentUser as User)).toBe(true);
  await submit();
  expect(authEntryHeld(api.auth.currentUser as User)).toBe(true);
  await age("under16");
  await submit();
  expect(authEntryHeld(api.auth.currentUser as User)).toBe(true);
  await age("16plus");
  await submit();
  expect(authEntryHeld(api.auth.currentUser as User)).toBe(false);
  expect(api.create).not.toHaveBeenCalled();
});
it.each(["ar", "he", "en"] as const)(
  "starts with a neutral, unselected age choice at the final step in %s",
  async (language) => {
    await render(language);
    await click(".auth-journey-switch button");
    await accountDetails();
    const select = element.querySelector<HTMLSelectElement>("select")!;
    expect(select.value).toBe("");
    expect(select.getAttribute("aria-label")).toBe(
      registrationText[language].age,
    );
    expect(element.querySelector("input[type=date]")).toBeNull();
  },
);
