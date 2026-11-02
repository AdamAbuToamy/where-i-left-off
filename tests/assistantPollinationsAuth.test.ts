// @vitest-environment jsdom
import { beforeEach, afterEach, it, expect, vi } from "vitest";
const sdk = vi.hoisted(() => ({ authorize: vi.fn(), command: vi.fn() }));
vi.mock("@pollinations/sdk", () => ({ authorizeDevice: sdk.authorize }));
vi.mock("../src/assistant/accountConnection", () => ({
  connectionCommand: sdk.command,
}));
vi.mock("../src/lib/firebase", () => ({ emulatorMode: false }));
import {
  connectPollinations,
  pollinationsConnected,
  restorePollinations,
  disconnectPollinations,
} from "../src/assistant/pollinationsAuth";
beforeEach(() => {
  sessionStorage.clear();
  vi.resetAllMocks();
});
afterEach(() => vi.unstubAllGlobals());
it("saves an approved key to the Wilo account and never retains it in browser storage", async () => {
  const popup = { closed: false, location: { href: "" }, close: vi.fn() };
  vi.stubGlobal(
    "open",
    vi.fn(() => popup),
  );
  sdk.authorize.mockResolvedValue({
    verificationUri: "https://enter.pollinations.ai/device?user_code=TEST",
    poll: async () => "sk_synthetic",
  });
  sdk.command.mockResolvedValue(true);
  await connectPollinations("alice");
  expect(sdk.command).toHaveBeenCalledWith(
    "alice",
    "connection-save",
    "sk_synthetic",
  );
  expect(sessionStorage.getItem("wilo-pollinations:alice")).toBeNull();
  expect(pollinationsConnected("alice")).toBe(true);
  expect(pollinationsConnected("bob")).toBe(false);
  sdk.command.mockResolvedValue(false);
  await disconnectPollinations("alice");
  expect(pollinationsConnected("alice")).toBe(false);
});
it("restores another device using account status without receiving a provider key", async () => {
  sdk.command.mockResolvedValue(true);
  expect(await restorePollinations("other-device")).toBe(true);
  expect(sdk.command).toHaveBeenCalledWith(
    "other-device",
    "connection-status",
  );
  expect(pollinationsConnected("other-device")).toBe(true);
});
it("migrates a legacy session only after a successful encrypted server save", async () => {
  sessionStorage.setItem("wilo-pollinations:legacy", "sk_synthetic");
  sdk.command.mockRejectedValueOnce(new Error("offline"));
  await expect(restorePollinations("legacy")).rejects.toThrow("offline");
  expect(sessionStorage.getItem("wilo-pollinations:legacy")).toBe(
    "sk_synthetic",
  );
  sdk.command.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await restorePollinations("legacy");
  expect(sdk.command).toHaveBeenLastCalledWith("legacy","connection-save","sk_synthetic");
  expect(sessionStorage.getItem("wilo-pollinations:legacy")).toBeNull();
});
it("does not erase a connection when a status request fails or disconnect fails", async () => {
  sdk.command.mockResolvedValueOnce(true);
  await restorePollinations("keep");
  sdk.command.mockRejectedValue(new Error("offline"));
  await expect(restorePollinations("keep")).rejects.toThrow();
  await expect(disconnectPollinations("keep")).rejects.toThrow();
  expect(pollinationsConnected("keep")).toBe(true);
});
it("does not start authorization when the browser blocks the window", async () => {
  vi.stubGlobal("open", () => null);
  await expect(connectPollinations("blocked")).rejects.toThrow(
    "assistant-popup-blocked",
  );
  expect(sdk.authorize).not.toHaveBeenCalled();
});

it('keeps the existing account binding authoritative over a stale device key',async()=>{
 sessionStorage.setItem('wilo-pollinations:stale','sk_old_device');sdk.command.mockResolvedValue(true);
 await restorePollinations('stale');expect(sdk.command).toHaveBeenCalledTimes(1);expect(sdk.command).toHaveBeenCalledWith('stale','connection-status');expect(sessionStorage.getItem('wilo-pollinations:stale')).toBeNull();
});
