import { it, expect, vi, beforeEach } from "vitest";
const readAgain = vi.hoisted(() =>
  vi.fn(() => Promise.reject(new Error("unavailable"))),
);
const failure = vi.hoisted(() => ({ value: null as unknown }));
beforeEach(() => {
  failure.value = null;
});
const set = vi.hoisted(() => vi.fn());
vi.mock("firebase/firestore", () => ({
  doc: () => ({ id: "session" }),
  serverTimestamp: () => ({ sentinel: true }),
  onSnapshot: vi.fn(),
  getDocFromServer: readAgain,
  runTransaction: async (
    _db: unknown,
    work: (transaction: unknown) => Promise<void>,
  ) => {
    if (failure.value) throw failure.value;
    return work({ get: async () => ({ exists: () => false }), set });
  },
}));
import type { Firestore } from "firebase/firestore";
import { FirestoreSessionRemote } from "../src/session/firestoreRemote";
import { emptySession } from "../src/session/domain";
it("accepts a server-acknowledged transaction without an extra read that could falsely report a failed save", async () => {
  const identity = {
    id: "session",
    projectId: "card",
    groupId: "",
    startedAt: 1,
  };
  const remote = new FirestoreSessionRemote(
      {} as Firestore,
      "owner",
      identity,
      () => true,
    ),
    state = emptySession(identity);
  const saved = await remote.write(state, null, "mutation");
  expect(saved).toEqual({ state, revision: 0, mutationId: "mutation" });
  expect(set).toHaveBeenCalledOnce();
  expect(readAgain).not.toHaveBeenCalled();
});

it("maps provider failures to safe codes while retaining the cause locally", async () => {
  const identity = {
    id: "session",
    projectId: "card",
    groupId: "",
    startedAt: 1,
  };
  const provider = Object.assign(new Error("Private provider details"), {
    code: "firestore/permission-denied",
  });
  failure.value = provider;
  const remote = new FirestoreSessionRemote(
    {} as Firestore,
    "owner",
    identity,
    () => true,
  );
  await expect(
    remote.write(emptySession(identity), null, "mutation"),
  ).rejects.toMatchObject({
    code: "permission-denied",
    message: "permission-denied",
    cause: provider,
  });
});
