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
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { FirestoreSessionRemote } from "../src/session/firestoreRemote";
import { emptySession, planSessionOperations } from "../src/session/domain";
let env: RulesTestEnvironment;
const identity = {
  id: "session",
  projectId: "card",
  groupId: "",
  startedAt: 100,
};
const data = () => ({
  projectId: "card",
  groupId: "",
  startedAt: 100,
  payload: JSON.stringify(emptySession(identity)),
  revision: 0,
  mutationId: "mutation",
  updatedAt: serverTimestamp(),
});
const client = (uid: string) =>
  env.authenticatedContext(uid, { email: uid + "@example.test" }).firestore();
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-session-voice",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "users/alice/projects/card"), {
      name: "Card",
    });
  });
});
afterAll(async () => {
  await env.cleanup();
});
it("isolates owners and validates revision, identity and payload bounds", async () => {
  const alice = client("alice"),
    bob = client("bob"),
    ref = doc(alice, "users/alice/sessionWorkspaces/session");
  await assertSucceeds(setDoc(ref, data()));
  await assertFails(getDoc(doc(bob, "users/alice/sessionWorkspaces/session")));
  await assertFails(
    setDoc(doc(bob, "users/alice/sessionWorkspaces/forged"), data()),
  );
  await assertFails(
    updateDoc(ref, { revision: 0, updatedAt: serverTimestamp() }),
  );
  await assertFails(
    updateDoc(ref, {
      revision: 1,
      projectId: "other",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(ref, {
      revision: 1,
      payload: "x".repeat(180001),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(ref, { revision: 1, extra: true, updatedAt: serverTimestamp() }),
  );
  await assertSucceeds(
    updateDoc(ref, {
      revision: 1,
      mutationId: "next",
      updatedAt: serverTimestamp(),
    }),
  );
});
it("rejects nonexistent cards and unauthorized groups", async () => {
  const db = client("alice");
  await assertFails(
    setDoc(doc(db, "users/alice/sessionWorkspaces/missing"), {
      ...data(),
      projectId: "missing",
    }),
  );
  await assertFails(
    setDoc(doc(db, "users/alice/sessionWorkspaces/team"), {
      ...data(),
      groupId: "foreign",
    }),
  );
});
it("round-trips the real adapter and rejects stale writes atomically", async () => {
  const db = client("alice"),
    adapter = new FirestoreSessionRemote(db, "alice", identity, () => true);
  let state = emptySession(identity);
  state = planSessionOperations(
    state,
    {
      sessionId: state.id,
      baseRevision: 0,
      origin: "voice",
      operations: [
        {
          verb: "add_item",
          operationId: "add",
          id: "item",
          text: "Firebase login",
        },
      ],
    },
    200,
  );
  const saved = await adapter.write(state, null, "first");
  expect(saved.state.items[0].text).toBe("Firebase login");
  expect(saved.revision).toBe(0);
  await expect(
    adapter.write(emptySession(identity), null, "stale"),
  ).rejects.toThrow("session-conflict");
  const reloaded = await getDoc(
    doc(db, "users/alice/sessionWorkspaces/session"),
  );
  expect(JSON.parse(reloaded.data()!.payload).items).toHaveLength(1);
});

it("requires a real group card and keeps private notes inaccessible to other group members", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups/team"), { deleted: false });
    await setDoc(doc(db, "groups/team/members/alice"), { role: "member" });
    await setDoc(doc(db, "groups/team/members/bob"), { role: "manager" });
    await setDoc(doc(db, "groups/team/projects/card"), { name: "Shared" });
  });
  const db = client("alice"),
    ref = doc(db, "users/alice/sessionWorkspaces/team-session");
  await assertSucceeds(setDoc(ref, { ...data(), groupId: "team" }));
  await assertFails(
    setDoc(doc(db, "users/alice/sessionWorkspaces/forged-card"), {
      ...data(),
      groupId: "team",
      projectId: "missing",
    }),
  );
  await assertFails(
    getDoc(doc(client("bob"), "users/alice/sessionWorkspaces/team-session")),
  );
});
it("blocks suspended accounts and pending account deletion", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "appMetrics/alice"), { suspended: true });
    await setDoc(doc(db, "accountDeletions/bob"), { status: "pending" });
  });
  await assertFails(
    setDoc(doc(client("alice"), "users/alice/sessionWorkspaces/s"), data()),
  );
  await assertFails(
    getDoc(doc(client("alice"), "users/alice/sessionWorkspaces/s")),
  );
  await assertFails(
    setDoc(doc(client("bob"), "users/bob/sessionWorkspaces/s"), data()),
  );
});
