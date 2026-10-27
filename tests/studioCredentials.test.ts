// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
const fixture = vi.hoisted(() => ({
  user: {
    uid: "admin",
    email: "adam2002hosny@gmail.com",
    emailVerified: true,
  } as { uid: string; email: string; emailVerified: boolean } | null,
}));
vi.mock("../src/lib/firebase", () => ({
  auth: {
    get currentUser() {
      return fixture.user;
    },
  },
}));
vi.mock("../src/assistant/pollinationsAuth", () => ({
  pollinationsKey: (uid: string) => {
    const key = sessionStorage.getItem("wilo-pollinations:" + uid);
    if (!key) throw new Error("assistant-connect-required");
    return key;
  },
  connectPollinations: async (_uid: string, save: (key: string) => void) =>
    save("preview-test-credential"),
}));
import {
  studioPollinationsKey,
  studioPollinationsConnected,
  connectStudioPollinations,
  disconnectStudioPollinations,
} from "../src/studio/adapters/credentials";
beforeEach(() => {
  sessionStorage.clear();
  fixture.user = {
    uid: "admin",
    email: "adam2002hosny@gmail.com",
    emailVerified: true,
  };
});
it("reuses an existing same-user provider session without changing its key", () => {
  sessionStorage.setItem("wilo-pollinations:admin", "existing-test-credential");
  expect(studioPollinationsKey("admin")).toBe("existing-test-credential");
  expect(sessionStorage.getItem("wilo-studio-pollinations:admin")).toBeNull();
});
it("disconnecting or connecting the preview leaves the public assistant session unchanged", async () => {
  sessionStorage.setItem("wilo-pollinations:admin", "existing-test-credential");
  disconnectStudioPollinations("admin");
  expect(studioPollinationsConnected("admin")).toBe(false);
  expect(sessionStorage.getItem("wilo-pollinations:admin")).toBe(
    "existing-test-credential",
  );
  await connectStudioPollinations("admin");
  expect(studioPollinationsKey("admin")).toBe("preview-test-credential");
  expect(sessionStorage.getItem("wilo-pollinations:admin")).toBe(
    "existing-test-credential",
  );
  expect(localStorage.getItem("wilo-studio-pollinations:admin")).toBeNull();
});
it("rejects credentials for another account or an unverified identity", () => {
  sessionStorage.setItem("wilo-pollinations:admin", "existing-test-credential");
  expect(() => studioPollinationsKey("other")).toThrow("studio-permission");
  fixture.user!.emailVerified = false;
  expect(studioPollinationsConnected("admin")).toBe(false);
  expect(() => disconnectStudioPollinations("admin")).toThrow(
    "studio-permission",
  );
});
