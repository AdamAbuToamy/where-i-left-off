// @vitest-environment jsdom
import { expect, it, vi } from "vitest";
const actor = vi.hoisted(() => ({ uid: "alice" }));
vi.mock("../src/lib/firebase", () => ({
  auth: {
    get currentUser() {
      return { uid: actor.uid };
    },
  },
  db: { app: { options: { projectId: "test" } } },
}));
import { boardNavigationCache } from "../src/planning/browserRepository";
it("keeps viewport state private to account/scope and refuses corrupt geometry", () => {
  localStorage.clear();
  actor.uid = "alice";
  const a = boardNavigationCache("alice", ""),
    group = boardNavigationCache("alice", "abcdefghijklmnopqrst");
  const navigation = { x: 100, y: -50, zoom: 0.8, selected: "card" };
  a.write(navigation);
  expect(a.read()).toEqual(navigation);
  expect(group.read()).toBeNull();
  expect(() => a.write({ ...navigation, zoom: Infinity })).toThrow();
  actor.uid = "bob";
  expect(boardNavigationCache("bob", "").read()).toBeNull();
  expect(() => a.read()).toThrow("planning-account");
  expect(() => a.write(navigation)).toThrow("planning-account");
  actor.uid = "alice";
  localStorage.setItem(
    "planning-navigation:v1/test/alice/personal",
    '{"zoom":999}',
  );
  expect(a.read()).toBeNull();
});
