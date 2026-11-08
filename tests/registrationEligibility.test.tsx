// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import type { Language } from "../src/translations";
const api = vi.hoisted(() => ({
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
vi.mock("../src/lib/firebase", () => ({ auth: {} }));
vi.mock("../src/lib/logging", () => ({
  traced: async (_name: string, action: () => Promise<unknown>) => action(),
}));
import AuthPanel from "../src/components/AuthPanel";
import { registrationEligible } from "../src/lib/registrationEligibility";
import { registrationText } from "../src/components/registrationText";
let element: HTMLDivElement, root: ReturnType<typeof createRoot>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  api.create.mockResolvedValue({ user: { uid: "new-user" } });
  api.profile.mockResolvedValue(undefined);
  api.signIn.mockResolvedValue({ user: { uid: "existing" } });
  api.google.mockResolvedValue({ user: { uid: "google" } });
  element = document.createElement("div");
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
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
it("does not contact account creation or collect form details before eligibility", async () => {
  await render();
  await click(".form-actions button");
  expect(element.querySelector("#email")).toBeNull();
  await submit();
  expect(api.create).not.toHaveBeenCalled();
  await age("under16");
  await submit();
  await click(".secondary-button");
  expect(api.create).not.toHaveBeenCalled();
  expect(api.google).not.toHaveBeenCalled();
  expect(element.textContent).toContain("New accounts are available");
  expect(element.querySelector("#email")).toBeNull();
});
it("registers an eligible person and never stores an age or DOB", async () => {
  await render();
  await click(".form-actions button");
  await age("16plus");
  await field("name", "Name");
  await field("email", "person@example.test");
  await field("password", "Test-password");
  await submit();
  expect(api.create).toHaveBeenCalledWith(
    {},
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
  await field("password", "Existing-password");
  await submit();
  expect(api.signIn).toHaveBeenCalledTimes(1);
  expect(api.create).not.toHaveBeenCalled();
  expect(element.querySelector('[aria-label="Age group"]')).toBeNull();
});
it("screens the Google account-creation path before any provider popup", async () => {
  await render();
  await click(".form-actions button");
  await click(".secondary-button");
  expect(api.google).not.toHaveBeenCalled();
  await age("under16");
  await click(".secondary-button");
  expect(api.google).not.toHaveBeenCalled();
  await age("16plus");
  await click(".secondary-button");
  expect(api.google).toHaveBeenCalledTimes(1);
});
it.each(["ar", "he", "en"] as const)(
  "starts with a neutral, unselected age choice in %s",
  async (language) => {
    await render(language);
    await click(".form-actions button");
    const select = element.querySelector<HTMLSelectElement>("select")!;
    expect(select.value).toBe("");
    expect(select.getAttribute("aria-label")).toBe(
      registrationText[language].age,
    );
    expect(element.querySelector("input[type=date]")).toBeNull();
  },
);
