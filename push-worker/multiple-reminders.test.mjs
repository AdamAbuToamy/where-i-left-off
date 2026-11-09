import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { database } from "./test-db.mjs";
import { defaults, cardKey } from "./policy.mjs";
import { createApiHandler } from "./src/apiEndpoint.mjs";
import { manageApiKeys } from "./src/apiKeys.mjs";
import { createWorker } from "./src/index.mjs";
import { MemoryRepository } from "../tests/helpers/apiMemoryRepository.mjs";
const NOW = Date.parse("2026-11-08T12:00:00Z"),
  ID = "p".repeat(20);
async function setup(push) {
  const DB = database();
  for (const f of ["api-schema.sql", "reminder-link-schema.sql"])
    DB.sqlite.exec(readFileSync(new URL(f, import.meta.url), "utf8"));
  const queue = [],
    sent = [],
    env = {
      DB,
      PUBLIC_API_ENABLED: "true",
      APP_ORIGINS: "https://app.example",
      PUSH_QUEUE: {
        async send(body) {
          queue.push(body);
        },
        async sendBatch(items) {
          queue.push(...items.map((i) => i.body));
        },
      },
    },
    repository = new MemoryRepository("alice");
  repository.seed("projects", ID, {
    id: ID,
    name: "A book to return to",
    nextStep: "Read chapter2",
    kind: "resource",
    resourceType: "book",
    status: "done",
    dueDate: "",
    revision: 0,
  });
  const scopes = ["reminders:read", "reminders:write", "projects:read"],
    key = await manageApiKeys(env, "alice", {
      action: "create",
      name: "Synthetic",
      scopes,
    }),
    repos = { alice: repository, bob: new MemoryRepository("bob") };
  const p = {
    ...defaults,
    enabled: true,
    due: false,
    quiet: false,
    timezone: "Asia/Jerusalem",
    hideContent: false,
  };
  await DB.prepare(
    "UPDATE accounts SET prefs=?,enabled=1,enabled_at=? WHERE uid=?",
  )
    .bind(JSON.stringify(p), NOW - 86400000, "alice")
    .run();
  await DB.prepare("INSERT INTO devices(id,uid,subscription) VALUES(?,?,?)")
    .bind("phone", "alice", "{}")
    .run();
  const handler = createApiHandler({
    assertAccount: async () => {},
    repository: (_, uid) => repos[uid],
  });
  const worker = createWorker({
    accountAvailable: async () => {},
    verifyIdentity: async () => ({
      uid: "alice",
      emailVerified: true,
      token: "synthetic",
    }),
    cardDocument: async () => repository.get("projects", ID),
    scopeProjects: async () => [repository.get("projects", ID)],
    sendPush: push || (async (_, subscription, payload) => sent.push(payload)),
  });
  const call = (
    method = "GET",
    body,
    idem = "universal-reminder-0001",
    token = key.key,
    match = "",
  ) =>
    handler(
      new Request(
        "https://api.example/api/v1/projects/" + ID + "/reminders" + match,
        {
          method,
          headers: {
            authorization: "Bearer " + token,
            "content-type": "application/json",
            "idempotency-key": idem,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      ),
      env,
    );
  const read = async () => {
    const r = await call();
    assert.equal(r.status, 200);
    return (await r.json()).result;
  };
  const drain = async () => {
    while (queue.length) {
      const body = queue.shift();
      let retry = false;
      await worker.queue(
        {
          messages: [
            {
              body,
              ack() {},
              retry() {
                retry = true;
              },
            },
          ],
        },
        env,
      );
      assert.equal(retry, false);
    }
  };
  return {
    DB,
    env,
    repository,
    repos,
    key,
    scopes,
    p,
    handler,
    worker,
    call,
    read,
    queue,
    sent,
    drain,
  };
}

const absolute = (at) => ({
  mode: "absolute",
  scheduledAt: new Date(at).toISOString(),
  timeZone: "Asia/Jerusalem",
});
async function result(response, status = 200) {
  assert.equal(response.status, status, await response.clone().text());
  return (await response.json()).result;
}
const add = (s, n, schedule = absolute(NOW + 120000)) =>
  s.call(
    "POST",
    { schedule },
    "multiple-reminder-" + String(n).padStart(5, "0"),
  );
test("three persisted reminders coexist; selected edit/cancel and retries preserve siblings", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const a = await result(await add(s, 1), 201),
      b = await result(await add(s, 2, absolute(NOW + 180000)), 201),
      c = await result(await add(s, 3, absolute(NOW + 240000)), 201);
    assert.equal(new Set([a.id, b.id, c.id]).size, 3);
    assert.equal((await s.read()).items.length, 3);
    assert.equal((await result(await add(s, 1), 201)).id, a.id);
    assert.equal((await s.read()).items.length, 3);
    const edited = await result(
      await s.call(
        "PATCH",
        { schedule: absolute(NOW + 360000), expectedRevision: b.revision },
        "multiple-reminder-edit001",
        s.key.key,
        "/" + b.id,
      ),
    );
    assert.equal(edited.revision, 1);
    assert.equal(edited.scheduledAt, new Date(NOW + 360000).toISOString());
    assert.equal(
      (
        await s.call(
          "PATCH",
          { schedule: absolute(NOW + 400000), expectedRevision: 0 },
          "multiple-reminder-edit002",
          s.key.key,
          "/" + b.id,
        )
      ).status,
      409,
    );
    const cancelled = await result(
      await s.call(
        "DELETE",
        { expectedRevision: a.revision },
        "multiple-reminder-delete01",
        s.key.key,
        "/" + a.id,
      ),
    );
    assert.equal(cancelled.status, "cancelled");
    const items = (await s.read()).items;
    assert.equal(items.length, 3);
    assert.equal(items.find((x) => x.id === c.id).scheduledAt, c.scheduledAt);
    assert.equal(
      (
        await s.call(
          "POST",
          { schedule: absolute(NOW + 600000) },
          "multiple-reminder-00001",
        )
      ).status,
      409,
    );
  } finally {
    s.DB.sqlite.close();
  }
});
test("ownership isolation, scopes, future validation and card enable revision checks", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const bob = await manageApiKeys(s.env, "bob", {
      action: "create",
      name: "Other",
      scopes: s.scopes,
    });
    assert.equal(
      (await s.call("GET", undefined, undefined, bob.key)).status,
      404,
    );
    const read = await manageApiKeys(s.env, "alice", {
      action: "create",
      name: "Read only",
      scopes: ["reminders:read"],
    });
    assert.equal(
      (
        await s.call(
          "POST",
          { schedule: absolute(NOW + 1) },
          undefined,
          read.key,
        )
      ).status,
      403,
    );
    assert.equal((await add(s, 1, absolute(NOW - 1))).status, 409);
    assert.equal(
      (
        await s.call("POST", {
          schedule: absolute(NOW + 100000),
          enableCard: true,
          expectedSettingsVersion: "stale",
        })
      ).status,
      409,
    );
    assert.equal((await s.read()).items.length, 0);
    const before = await s.read();
    await result(
      await s.call("POST", {
        schedule: absolute(NOW + 100000),
        enableCard: true,
        expectedSettingsVersion: before.settingsVersion,
      }),
      201,
    );
    assert.equal((await s.read()).items.length, 1);
  } finally {
    s.DB.sqlite.close();
  }
});
test("relative 4/2 calendar days follow deadlines, absolute/cancelled retain independence", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    s.repository.seed("projects", ID, {
      ...s.repository.get("projects", ID),
      dueDate: "2026-11-18",
    });
    const rel = (n) => ({
      mode: "relative",
      amount: n,
      unit: "days",
      localTime: "09:00",
      timeZone: "Asia/Jerusalem",
    });
    const a = await result(await add(s, 1, rel(4)), 201),
      b = await result(await add(s, 2, rel(2)), 201),
      c = await result(await add(s, 3, absolute(NOW + 999999)), 201);
    assert.equal(a.scheduledAt, "2026-11-14T07:00:00.000Z");
    assert.equal(b.scheduledAt, "2026-11-16T07:00:00.000Z");
    await result(
      await s.call(
        "DELETE",
        { expectedRevision: b.revision },
        "multiple-cancel-relative01",
        s.key.key,
        "/" + b.id,
      ),
    );
    s.repository.seed("projects", ID, {
      ...s.repository.get("projects", ID),
      dueDate: "2026-11-19",
    });
    const items = (await s.read()).items;
    assert.equal(
      items.find((x) => x.id === a.id).scheduledAt,
      "2026-11-15T07:00:00.000Z",
    );
    assert.equal(items.find((x) => x.id === b.id).status, "cancelled");
    assert.equal(items.find((x) => x.id === c.id).scheduledAt, c.scheduledAt);
  } finally {
    s.DB.sqlite.close();
  }
});
async function plan(s) {
  await s.worker.scheduled({}, s.env);
  await s.drain();
}
test("same-time reminders dispatch independently through native queue; replay and sent deadline changes cannot resend", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const a = await result(await add(s, 1), 201),
      b = await result(await add(s, 2), 201);
    t.mock.timers.setTime(NOW + 120000);
    await plan(s);
    assert.equal(s.sent.length, 2);
    assert.notEqual(s.sent[0].tag, s.sent[1].tag);
    assert.equal(
      (await s.read()).items.find((x) => x.id === a.id).status,
      "provider-accepted",
    );
    t.mock.timers.setTime(NOW + 300000);
    await plan(s);
    assert.equal(s.sent.length, 2);
    const rows = (await s.read()).items;
    assert.equal(rows.find((x) => x.id === b.id).status, "provider-accepted");
  } finally {
    s.DB.sqlite.close();
  }
});
test("cancelled queued reminder is suppressed without cancelling its sibling", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const a = await result(await add(s, 1), 201);
    await result(await add(s, 2), 201);
    t.mock.timers.setTime(NOW + 120000);
    await s.worker.scheduled({}, s.env);
    const planning = s.queue.shift();
    await s.worker.queue(
      {
        messages: [
          {
            body: planning,
            ack() {},
            retry() {
              throw Error("retry");
            },
          },
        ],
      },
      s.env,
    );
    await result(
      await s.call(
        "DELETE",
        { expectedRevision: a.revision },
        "multiple-cancel-pending01",
        s.key.key,
        "/" + a.id,
      ),
    );
    await s.drain();
    assert.equal(s.sent.length, 1);
  } finally {
    s.DB.sqlite.close();
  }
});

test("legacy settings survive additive migration; cancelling legacy leaves new reminders active", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const settings = {
      schedule: absolute(NOW + 120000),
      weekly: false,
      time: "09:00",
      disabled: false,
    };
    await s.DB.prepare("INSERT INTO cards(uid,id,settings) VALUES(?,?,?)")
      .bind("alice", cardKey(ID), JSON.stringify(settings))
      .run();
    s.DB.sqlite.exec(
      readFileSync(
        new URL("multiple-reminders-schema.sql", import.meta.url),
        "utf8",
      ),
    );
    assert.deepEqual(
      JSON.parse(
        (
          await s.DB.prepare("SELECT settings FROM cards WHERE uid=?")
            .bind("alice")
            .first()
        ).settings,
      ),
      settings,
    );
    await result(await add(s, 1), 201);
    const old = (await s.read()).items.find((x) => x.id === "legacy");
    assert.ok(old);
    await result(
      await s.call(
        "DELETE",
        { expectedSettingsVersion: old.settingsVersion },
        "multiple-legacy-cancel01",
        s.key.key,
        "/legacy",
      ),
    );
    assert.equal(
      (await s.read()).items.find((x) => x.id === "legacy").status,
      "cancelled",
    );
    t.mock.timers.setTime(NOW + 120000);
    await plan(s);
    assert.equal(s.sent.length, 1);
  } finally {
    s.DB.sqlite.close();
  }
});
test("sent relative reminders freeze their event across deadline changes; manual edit rearms only selected record", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    s.repository.seed("projects", ID, {
      ...s.repository.get("projects", ID),
      dueDate: "2026-11-10",
    });
    const a = await result(
      await add(s, 1, {
        mode: "relative",
        amount: 1,
        unit: "days",
        localTime: "09:00",
        timeZone: "Asia/Jerusalem",
      }),
      201,
    );
    const at = Date.parse(a.scheduledAt);
    t.mock.timers.setTime(at);
    await plan(s);
    assert.equal(s.sent.length, 1);
    s.repository.seed("projects", ID, {
      ...s.repository.get("projects", ID),
      dueDate: "2026-11-11",
    });
    assert.equal((await s.read()).items[0].scheduledAt, a.scheduledAt);
    t.mock.timers.setTime(at + 86400000);
    await plan(s);
    assert.equal(s.sent.length, 1);
    assert.equal((await s.read()).items[0].status, "provider-accepted");
    await result(
      await s.call(
        "PATCH",
        {
          schedule: absolute(at + 86400000 + 120000),
          expectedRevision: a.revision,
        },
        "multiple-rearm-selected01",
        s.key.key,
        "/" + a.id,
      ),
    );
    t.mock.timers.setTime(at + 86400000 + 120000);
    await plan(s);
    assert.equal(s.sent.length, 2);
  } finally {
    s.DB.sqlite.close();
  }
});
test("lost queue acknowledgement recovers through existing planner without duplicate dispatch", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    await result(await add(s, 1), 201);
    t.mock.timers.setTime(NOW + 120000);
    await s.worker.scheduled({}, s.env);
    const msg = s.queue.shift();
    await s.worker.queue(
      {
        messages: [
          {
            body: msg,
            ack() {},
            retry() {
              throw Error("retry");
            },
          },
        ],
      },
      s.env,
    );
    const lost = s.queue.splice(0);
    assert.equal(lost.length, 1);
    t.mock.timers.setTime(NOW + 300000);
    await plan(s);
    assert.equal(s.sent.length, 1);
    s.queue.push(...lost);
    await s.drain();
    assert.equal(s.sent.length, 1);
  } finally {
    s.DB.sqlite.close();
  }
});
test("quiet hours, account/card opt-out and device withdrawal govern independent reminders", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    await result(await add(s, 1), 201);
    const quiet = {
      ...s.p,
      quiet: true,
      quietStart: "00:00",
      quietEnd: "23:59",
    };
    await s.DB.prepare("UPDATE accounts SET prefs=? WHERE uid=?")
      .bind(JSON.stringify(quiet), "alice")
      .run();
    t.mock.timers.setTime(NOW + 120000);
    await plan(s);
    assert.equal(s.sent.length, 0);
    assert.ok(Date.parse((await s.read()).items[0].effectiveAt) > NOW + 120000);
    await s.DB.prepare("UPDATE accounts SET prefs=?,enabled=0 WHERE uid=?")
      .bind(JSON.stringify({ ...s.p, enabled: false }), "alice")
      .run();
    await plan(s);
    assert.equal((await s.read()).items[0].status, "disabled");
    await s.DB.prepare("UPDATE accounts SET prefs=?,enabled=1 WHERE uid=?")
      .bind(JSON.stringify(s.p), "alice")
      .run();
    await s.DB.prepare("INSERT INTO cards(uid,id,settings) VALUES(?,?,?)")
      .bind("alice", cardKey(ID), JSON.stringify({ disabled: true }))
      .run();
    await plan(s);
    assert.equal((await s.read()).items[0].status, "disabled");
    await s.DB.prepare("UPDATE cards SET settings='{}' WHERE uid=?")
      .bind("alice")
      .run();
    await s.DB.prepare("DELETE FROM devices WHERE uid=?").bind("alice").run();
    assert.equal((await s.read()).items[0].status, "awaiting-device");
    await plan(s);
    assert.equal(s.sent.length, 0);
  } finally {
    s.DB.sqlite.close();
  }
});

test("unknown provider outcome is truthful and never resent under queue replay", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  let attempts = 0;
  const s = await setup(async () => {
    attempts++;
    throw Error("synthetic-network-loss");
  });
  try {
    await result(await add(s, 1), 201);
    t.mock.timers.setTime(NOW + 120000);
    await s.worker.scheduled({}, s.env);
    const planning = s.queue.shift();
    await s.worker.queue(
      {
        messages: [
          {
            body: planning,
            ack() {},
            retry() {
              throw Error("plan failed");
            },
          },
        ],
      },
      s.env,
    );
    const delivery = s.queue.shift();
    let retried = false;
    await s.worker.queue(
      {
        messages: [
          {
            body: delivery,
            ack() {},
            retry() {
              retried = true;
            },
          },
        ],
      },
      s.env,
    );
    assert.equal(retried, true);
    assert.equal((await s.read()).items[0].status, "unknown");
    await s.worker.queue(
      {
        messages: [
          {
            body: delivery,
            ack() {},
            retry() {
              throw Error("replay failed");
            },
          },
        ],
      },
      s.env,
    );
    assert.equal(attempts, 1);
    t.mock.timers.setTime(NOW + 300000);
    await plan(s);
    assert.equal(attempts, 1);
  } finally {
    s.DB.sqlite.close();
  }
});
test("editing queued work invalidates only its old revision, retaining the new future schedule", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const a = await result(await add(s, 1), 201);
    await result(await add(s, 2), 201);
    t.mock.timers.setTime(NOW + 120000);
    await s.worker.scheduled({}, s.env);
    const planning = s.queue.shift();
    await s.worker.queue(
      {
        messages: [
          {
            body: planning,
            ack() {},
            retry() {
              throw Error("plan failed");
            },
          },
        ],
      },
      s.env,
    );
    await result(
      await s.call(
        "PATCH",
        { schedule: absolute(NOW + 360000), expectedRevision: a.revision },
        "multiple-edit-queued001",
        s.key.key,
        "/" + a.id,
      ),
    );
    await s.drain();
    assert.equal(s.sent.length, 1);
    t.mock.timers.setTime(NOW + 360000);
    await plan(s);
    assert.equal(s.sent.length, 2);
  } finally {
    s.DB.sqlite.close();
  }
});

test("authenticated UI and Public API share persisted records and individual revisions", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const native = (data) =>
      s.worker.fetch(
        new Request("https://worker.example/", {
          method: "POST",
          headers: {
            origin: "https://app.example",
            "content-type": "application/json",
          },
          body: JSON.stringify({ projectId: ID, ...data }),
        }),
        s.env,
      );
    await result(await add(s, 1), 201);
    await result(
      await native({
        action: "reminder-create",
        requestId: "multiple-native-create001",
        body: { schedule: absolute(NOW + 240000) },
      }),
    );
    assert.deepEqual(
      await result(await native({ action: "reminders-list" })),
      await s.read(),
    );
    const items = (await s.read()).items;
    await result(
      await native({
        action: "reminder-delete",
        reminderId: items[0].id,
        requestId: "multiple-native-cancel001",
        body: { expectedRevision: items[0].revision },
      }),
    );
    const persisted = await s.read();
    assert.equal(
      persisted.items.filter((x) => x.status === "cancelled").length,
      1,
    );
    assert.equal(persisted.items.filter((x) => x.state === "active").length, 1);
    assert.deepEqual(
      await result(await native({ action: "reminders-list" })),
      persisted,
    );
  } finally {
    s.DB.sqlite.close();
  }
});
