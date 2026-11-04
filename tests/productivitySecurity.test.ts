import { readFileSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, it } from "vitest";
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
  writeBatch,
} from "firebase/firestore";
import { emptyExperience } from "../src/productivity/state";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-productivity",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});
beforeEach(() => env.clearFirestore());
afterAll(() => env.cleanup());
const client = (uid: string, admin = false, verified = true) =>
  env
    .authenticatedContext(uid, {
      email: admin ? "adam2002hosny@gmail.com" : uid + "@example.test",
      email_verified: verified,
    })
    .firestore();
const data = () => ({
  version: 1,
  payload: JSON.stringify(emptyExperience()),
  revision: 1,
  mutationId: "one",
  updatedAt: serverTimestamp(),
});
it("admits only the verified active administrator writer and owner reader", async () => {
  const admin = client("admin", true),
    ref = doc(admin, "users/admin/experience/workspace");
  await assertSucceeds(setDoc(ref, data()));
  await assertSucceeds(getDoc(ref));
  await assertFails(
    getDoc(doc(client("other"), "users/admin/experience/workspace")),
  );
  await assertFails(
    setDoc(
      doc(client("ordinary"), "users/ordinary/experience/workspace"),
      data(),
    ),
  );
  await assertFails(
    setDoc(
      doc(
        client("unverified", true, false),
        "users/unverified/experience/workspace",
      ),
      data(),
    ),
  );
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "appMetrics/admin"), { suspended: true });
  });
  await assertFails(
    updateDoc(ref, { revision: 2, updatedAt: serverTimestamp() }),
  );
});
it("enforces revision increments and exact fields without granting arbitrary paths", async () => {
  const db = client("admin", true),
    ref = doc(db, "users/admin/experience/workspace");
  await assertFails(setDoc(ref, { ...data(), revision: 2 }));
  await assertFails(setDoc(ref, { ...data(), extra: true }));
  await assertSucceeds(setDoc(ref, data()));
  await assertFails(
    updateDoc(ref, { revision: 1, updatedAt: serverTimestamp() }),
  );
  await assertSucceeds(
    updateDoc(ref, { revision: 2, updatedAt: serverTimestamp() }),
  );
  await assertFails(setDoc(doc(db, "users/admin/experience/roles"), data()));
});

it("keeps embedded history in the same revision and refuses forged or foreign history writes", async () => {
  const db = client("admin", true),
    ref = doc(db, "users/admin/projects/history-card");
  const card = {
    name: "Old",
    nextStep: "Next",
    status: "later",
    rank: 0,
    revision: 0,
    mutationId: "first",
    updatedAt: serverTimestamp(),
  };
  const history = {
    entries: [],
    revision: 0,
    mutationId: "first",
    actorId: "admin",
    actorName: "Admin",
    source: "workspace",
  };
  await assertSucceeds(setDoc(ref, { ...card, versionHistory: history }));
  await assertFails(
    updateDoc(ref, {
      name: "New",
      revision: 1,
      mutationId: "second",
      updatedAt: serverTimestamp(),
      versionHistory: { ...history, revision: 1, mutationId: "second" },
    }),
  );
  const previous = {
    mutationId: "first",
    revision: 0,
    at: 0,
    actorId: "admin",
    actorName: "Admin",
    source: "workspace",
    payload: JSON.stringify({
      id: "history-card",
      name: "Old",
      nextStep: "Next",
      status: "later",
      rank: 0,
      revision: 0,
    }),
  };
  await assertSucceeds(
    updateDoc(ref, {
      name: "New",
      revision: 1,
      mutationId: "second",
      updatedAt: serverTimestamp(),
      versionHistory: {
        ...history,
        revision: 1,
        mutationId: "second",
        entries: [previous],
      },
    }),
  );
  await assertFails(
    updateDoc(ref, {
      name: "Wrong",
      revision: 2,
      mutationId: "third",
      updatedAt: serverTimestamp(),
      versionHistory: {
        ...history,
        revision: 2,
        mutationId: "third",
        actorId: "other",
        entries: [previous],
      },
    }),
  );
  await assertFails(
    setDoc(doc(client("ordinary"), "users/ordinary/projects/history-card"), {
      ...card,
      versionHistory: { ...history, actorId: "ordinary" },
    }),
  );
  await assertFails(
    updateDoc(doc(client("other"), "users/admin/projects/history-card"), {
      name: "Foreign",
    }),
  );
});

it("preserves a 50-card atomic edit with embedded history within rule access limits", async () => {
  const db = client("admin", true);
  let batch = writeBatch(db);
  for (let i = 0; i < 50; i++)
    batch.set(doc(db, "users/admin/projects/bulk-" + i), {
      name: "Before " + i,
      nextStep: "Next",
      status: "later",
      rank: i,
      revision: 0,
      mutationId: "initial",
      updatedAt: serverTimestamp(),
    });
  await assertSucceeds(batch.commit());
  batch = writeBatch(db);
  for (let i = 0; i < 50; i++)
    batch.update(doc(db, "users/admin/projects/bulk-" + i), {
      name: "After " + i,
      revision: 1,
      mutationId: "batch-update",
      updatedAt: serverTimestamp(),
      versionHistory: {
        entries: [
          {
            revision: 0,
            mutationId: "initial",
            at: 0,
            actorId: "admin",
            actorName: "",
            source: "legacy",
            payload: JSON.stringify({
              id: "bulk-" + i,
              name: "Before " + i,
              nextStep: "Next",
              status: "later",
              rank: i,
              revision: 0,
            }),
          },
        ],
        revision: 1,
        mutationId: "batch-update",
        actorId: "admin",
        actorName: "Admin",
        source: "assistant",
      },
    });
  await assertSucceeds(batch.commit());
});
