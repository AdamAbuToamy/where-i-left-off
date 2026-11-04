import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import type { RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { emptyPlanningState } from "../src/planning/domain";
let env: RulesTestEnvironment;
const client = (uid: string, verified = true) =>
  env
    .authenticatedContext(uid, {
      email: uid + "@example.test",
      email_verified: verified,
    })
    .firestore();
const data = (scope = "") => ({
  version: 1,
  scope,
  payload: JSON.stringify(emptyPlanningState()),
  revision: 1,
  mutationId: "first",
  updatedAt: serverTimestamp(),
});
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-planning-security",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
});
afterAll(async () => {
  await env.cleanup();
});
it("keeps board notes owner-only and exportable without granting another account or admin access", async () => {
  const alice = client("alice"),
    bob = client("bob"),
    ref = doc(alice, "users/alice/planningBoards/personal");
  await assertSucceeds(setDoc(ref, data()));
  await assertSucceeds(getDoc(ref));
  expect(
    (
      await assertSucceeds(
        getDocs(collection(alice, "users/alice/planningBoards")),
      )
    ).size,
  ).toBe(1);
  await assertFails(getDoc(doc(bob, ref.path)));
  await assertFails(getDocs(collection(bob, "users/alice/planningBoards")));
  await assertFails(setDoc(doc(bob, ref.path), data()));
  const admin = env
    .authenticatedContext("admin", {
      email: "adam2002hosny@gmail.com",
      email_verified: true,
    })
    .firestore();
  await assertFails(getDoc(doc(admin, ref.path)));
  await assertFails(
    getDoc(doc(env.unauthenticatedContext().firestore(), ref.path)),
  );
});
it("requires verified writers, bounded payloads, atomic revision increments and exact fields", async () => {
  const alice = client("alice"),
    ref = doc(alice, "users/alice/planningBoards/personal");
  await assertFails(setDoc(doc(client("alice", false), ref.path), data()));
  for (const override of [
    { revision: 0 },
    { revision: 3 },
    { payload: "x".repeat(150001) },
    { scope: "foreign" },
    { extra: true },
    { updatedAt: 0 },
    { mutationId: "bad id" },
    { version: 2 },
  ])
    await assertFails(setDoc(ref, { ...data(), ...override }));
  await assertSucceeds(setDoc(ref, data()));
  await assertFails(
    updateDoc(ref, { revision: 1, updatedAt: serverTimestamp() }),
  );
  await assertSucceeds(
    updateDoc(ref, {
      revision: 2,
      mutationId: "next",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(ref));
  await assertFails(
    setDoc(doc(alice, "users/alice/planningBoards/arbitrary"), data()),
  );
});
it("requires current group membership to write a private group-scoped canvas", async () => {
  const gid = "g".repeat(20),
    alice = client("alice"),
    ref = doc(alice, "users/alice/planningBoards/group_" + gid);
  await assertFails(setDoc(ref, data(gid)));
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "groups", gid), { deleted: false });
    await setDoc(doc(context.firestore(), "groups", gid, "members", "alice"), {
      role: "member",
    });
  });
  await assertSucceeds(setDoc(ref, data(gid)));
  await env.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(
      doc(context.firestore(), "groups", gid, "members", "alice"),
    );
  });
  await assertFails(
    updateDoc(ref, { revision: 2, updatedAt: serverTimestamp() }),
  );
  // Private user-authored notes remain exportable; referenced group cards are not copied here.
  await assertSucceeds(getDoc(ref));
});
it("blocks suspended or deleting accounts while leaving project records unchanged", async () => {
  const alice = client("alice"),
    ref = doc(alice, "users/alice/planningBoards/personal");
  await assertSucceeds(setDoc(ref, data()));
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "appMetrics/alice"), {
      suspended: true,
    });
  });
  await assertFails(getDoc(ref));
  await assertFails(
    updateDoc(ref, { revision: 2, updatedAt: serverTimestamp() }),
  );
  await env.withSecurityRulesDisabled(async (context) => {
    await deleteDoc(doc(context.firestore(), "appMetrics/alice"));
    await setDoc(doc(context.firestore(), "accountDeletions/alice"), {
      status: "pending",
    });
  });
  await assertFails(getDoc(ref));
  await assertFails(
    updateDoc(ref, { revision: 2, updatedAt: serverTimestamp() }),
  );
});
