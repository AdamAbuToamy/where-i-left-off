import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiRepository } from "./src/apiFirestore.mjs";
import { cardDocument } from "./src/firebase.mjs";
test("Firestore project writes omit the path ID so browser rules accept later edits", async () => {
  let commit;
  const repository = createApiRepository(
    { FIREBASE_PROJECT_ID: "synthetic" },
    "alice",
    {
      endpoint: "https://synthetic.invalid/documents",
      token: "synthetic",
      fetchImpl: async (url, init) => {
        if (url.endsWith(":beginTransaction"))
          return Response.json({ transaction: "synthetic" });
        if (url.endsWith(":batchGet"))
          return Response.json([{ missing: "synthetic" }]);
        if (url.endsWith(":commit")) {
          commit = JSON.parse(init.body);
          return Response.json({});
        }
        throw Error("Unexpected synthetic request");
      },
    },
  );
  await repository.transact(async (tx) =>
    tx.setProject("p".repeat(20), {
      id: "p".repeat(20),
      name: "Synthetic card",
      nextStep: "Next",
      rank: 1,
      status: "active",
      revision: 0,
    }),
  );
  assert.equal(commit.writes[0].update.fields.id, undefined);
  assert.equal(
    commit.writes[0].update.fields.name.stringValue,
    "Synthetic card",
  );
  assert.ok(!commit.writes[0].updateMask.fieldPaths.includes("id"));
});
test("native group reminder reads require membership but not assignment to the caller", async (t) => {
  const group = "g".repeat(20),
    id = "p".repeat(20);
  let member = true;
  t.mock.method(globalThis, "fetch", async (url) => {
    assert.match(url, /firestore.googleapis.com/);
    if (url.includes("/members/"))
      return member
        ? Response.json({ fields: { role: { stringValue: "member" } } })
        : new Response("{}", { status: 404 });
    if (url.endsWith("/projects/" + id))
      return Response.json({
        fields: {
          name: { stringValue: "Team card" },
          assignedTo: { stringValue: "bob" },
        },
      });
    return Response.json({ fields: { name: { stringValue: "Team" } } });
  });
  assert.equal(
    (
      await cardDocument(
        { FIREBASE_PROJECT_ID: "synthetic" },
        "alice",
        id,
        group,
        { auth: "synthetic-token" },
      )
    ).assignedTo,
    "bob",
  );
  member = false;
  await assert.rejects(
    cardDocument({ FIREBASE_PROJECT_ID: "synthetic" }, "alice", id, group, {
      auth: "synthetic-token",
    }),
    /card-unavailable/,
  );
});

test("additive quiet override migration preserves existing records and defaults every old key/event to off", async () => {
  const { DatabaseSync } = await import("node:sqlite"),
    { readFileSync } = await import("node:fs"),
    db = new DatabaseSync(":memory:");
  try {
    db.exec(
      "CREATE TABLE user_api_keys(id TEXT PRIMARY KEY);CREATE TABLE api_task_notifications(uid TEXT,task_id TEXT);INSERT INTO user_api_keys VALUES('old-key');INSERT INTO api_task_notifications VALUES('alice','old-event');",
    );
    db.exec(
      readFileSync(
        new URL("./quiet-override-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.equal(
      db.prepare("SELECT quiet_hours_override FROM user_api_keys").get()
        .quiet_hours_override,
      0,
    );
    const event = db.prepare("SELECT * FROM api_task_notifications").get();
    assert.equal(event.task_id, "old-event");
    assert.equal(event.bypass_quiet_hours, 0);
    assert.equal(event.requesting_key_id, "");
  } finally {
    db.close();
  }
});
