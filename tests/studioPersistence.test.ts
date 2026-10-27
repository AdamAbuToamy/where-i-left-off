// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { BrowserStudioPersistence } from "../src/studio/adapters/browserPersistence";
import { StudioRepository } from "../src/studio/core/repository";
import { studioSeed } from "../src/studio/core/seed";
const now = Date.parse("2026-10-27T12:00:00Z");
const admin = {
  uid: "admin",
  email: "adam2002hosny@gmail.com",
  emailVerified: true,
};
let identity: typeof admin | null;
beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  identity = { ...admin };
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: async (_name: string, action: () => unknown) => action(),
    },
  });
});
function repository(key = "private/admin") {
  return new StudioRepository(
    new BrowserStudioPersistence(key, () => identity, "admin"),
    () => studioSeed(now, "Adam", "en"),
    () => now,
  );
}
it("persists the initial sandbox without touching another account key", async () => {
  localStorage.setItem("public-account", "unchanged");
  const repo = repository();
  await repo.initialize();
  const stored = localStorage.getItem("private/admin");
  expect(stored).not.toBeNull();
  expect(JSON.parse(stored!).revision).toBe(0);
  expect(localStorage.getItem("public-account")).toBe("unchanged");
  expect(localStorage.getItem("private/other")).toBeNull();
});
it("rejects reads and writes after signout, unverified state or account switch", async () => {
  const repo = repository();
  await repo.initialize();
  const before = localStorage.getItem("private/admin");
  for (const next of [
    null,
    { ...admin, emailVerified: false },
    { ...admin, uid: "other" },
    { ...admin, email: "student@example.test" },
  ]) {
    identity = next;
    expect(() => repo.read()).toThrow("studio-permission");
    await expect(
      repo.execute({ kind: "settings", values: { mode: "dark" } }, 0),
    ).rejects.toThrow("studio-permission");
    expect(localStorage.getItem("private/admin")).toBe(before);
  }
});
it("leaves the previous journal intact when storage quota fails", async () => {
  const repo = repository();
  await repo.initialize();
  const before = localStorage.getItem("private/admin");
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
    this: Storage,
    key,
    value,
  ) {
    if (key === "private/admin")
      throw new DOMException("quota", "QuotaExceededError");
    original.call(this, key, value);
  });
  await expect(
    repo.execute({ kind: "settings", values: { mode: "dark" } }, 0),
  ).rejects.toThrow();
  expect(localStorage.getItem("private/admin")).toBe(before);
});
it("fails closed on malformed persisted state instead of resetting it automatically", () => {
  localStorage.setItem("private/admin", '{"invalid":true}');
  expect(() => repository().read()).toThrow();
  expect(localStorage.getItem("private/admin")).toBe('{"invalid":true}');
});
it("refuses unlocked writes on an unsupported browser", async () => {
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: undefined,
  });
  await expect(repository().initialize()).rejects.toThrow(
    "studio-lock-unavailable",
  );
  expect(localStorage.getItem("private/admin")).toBeNull();
});
