import { afterEach, expect, it, vi } from "vitest";
const context = vi.hoisted(() => ({
  user: { uid: "alice", getIdToken: vi.fn(async () => "firebase-test-token") },
  check: vi.fn(async () => ({ token: "app-check-test" })),
}));
vi.mock("../src/lib/firebase", () => ({
  auth: {
    get currentUser() {
      return context.user;
    },
  },
  appCheck: {},
  emulatorMode: false,
}));
vi.mock("firebase/app-check", () => ({ getToken: context.check }));
vi.mock("../src/lib/pushNotifications", () => ({
  notificationEndpoint: async () => "https://wilo-test.workers.dev/",
}));
import {
  accountConnection,
  connectionCommand,
} from "../src/assistant/accountConnection";
afterEach(() => vi.unstubAllGlobals());
it("checks the account with Firebase and App Check tokens without any provider credential", async () => {
  const transport = vi.fn(async (_url, init) => {
    expect(String(_url)).toBe(
      "https://wilo-test.workers.dev/assistant-account",
    );
    expect(init.headers.Authorization).toBe("Bearer firebase-test-token");
    expect(init.headers["X-Firebase-AppCheck"]).toBe("app-check-test");
    expect(JSON.parse(init.body)).toEqual({ action: "connection-status" });
    return Response.json({ result: { connected: true } });
  });
  vi.stubGlobal("fetch", transport);
  expect(await connectionCommand("alice", "connection-status")).toBe(true);
});
it("rejects requests for another Wilo user before sending anything", async () => {
  const transport = vi.fn();
  vi.stubGlobal("fetch", transport);
  await expect(
    accountConnection("bob", { action: "connection-status" }),
  ).rejects.toThrow("account-changed");
  expect(transport).not.toHaveBeenCalled();
});
it("does not interpret a temporary server failure or malformed status as a disconnected account", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ result: {} })),
  );
  await expect(connectionCommand("alice", "connection-status")).rejects.toThrow(
    "assistant-connection-unavailable",
  );
  await expect(connectionCommand("alice", "connection-status")).rejects.toThrow(
    "assistant-connection-unavailable",
  );
});
