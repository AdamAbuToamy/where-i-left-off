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
async function setup() {
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
    sendPush: async (_, subscription, payload) => sent.push(payload),
  });
  const call = (
    method = "GET",
    body,
    idem = "universal-reminder-0001",
    token = key.key,
    match = "",
  ) =>
    handler(
      new Request("https://api.example/api/v1/reminders/" + ID, {
        method,
        headers: {
          authorization: "Bearer " + token,
          "content-type": "application/json",
          "idempotency-key": idem,
          "if-match": match,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
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
test("any eligible book card, even completed/no due date, schedules from API and dispatches through the native planner to its phone", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const original = await s.read(),
      at = NOW + 120000;
    const body = {
      disabled: false,
      schedule: {
        mode: "absolute",
        scheduledAt: new Date(at).toISOString(),
        timeZone: "Asia/Jerusalem",
      },
      expectedSettingsVersion: original.settingsVersion,
    };
    const response = await s.call("PUT", body);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).result.status, "scheduled");
    assert.equal((await s.call("PUT", body)).status, 200);
    assert.equal(s.queue.length, 0);
    assert.equal((await s.read()).scheduledAt, new Date(at).toISOString());
    assert.equal((await s.read()).timeZone, "Asia/Jerusalem");
    t.mock.timers.setTime(at);
    await s.worker.scheduled({}, s.env);
    await s.drain();
    assert.equal(s.sent.length, 1);
    assert.equal(s.sent[0].uid, "alice");
    const status = await s.read();
    assert.equal(status.status, "provider-accepted");
    assert.equal(status.providerAccepted, 1);
    assert.equal(status.handsetDelivery, "not-confirmed");
    await s.worker.scheduled({}, s.env);
    await s.drain();
    assert.equal(s.sent.length, 1);
    const stored = await s.DB.prepare("SELECT prefs FROM accounts WHERE uid=?")
      .bind("alice")
      .first();
    assert.deepEqual(JSON.parse(stored.prefs), s.p);
  } finally {
    s.DB.sqlite.close();
    t.mock.timers.reset();
  }
});
test("relative calendar times and due-date edits recompute without rewriting explicit preferences", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    s.repository.seed("projects", ID, {
      ...s.repository.get("projects", ID),
      dueDate: "2026-11-18",
      status: "active",
    });
    const old = await s.read();
    const response = await s.call("PUT", {
      disabled: false,
      schedule: {
        mode: "relative",
        amount: 3,
        unit: "days",
        localTime: "09:00",
        dueTime: "23:59",
        timeZone: "Asia/Jerusalem",
      },
      expectedSettingsVersion: old.settingsVersion,
    });
    assert.equal(response.status, 200);
    assert.equal((await s.read()).scheduledAt, "2026-11-15T07:00:00.000Z");
    await s.DB.prepare("UPDATE accounts SET prefs=? WHERE uid=?")
      .bind(
        JSON.stringify({
          ...s.p,
          defaultTime: "18:00",
          leadMinutes: 60,
          timezone: "UTC",
        }),
        "alice",
      )
      .run();
    assert.equal((await s.read()).scheduledAt, "2026-11-15T07:00:00.000Z");
    s.repository.seed("projects", ID, {
      ...s.repository.get("projects", ID),
      dueDate: "2026-11-19",
    });
    assert.equal((await s.read()).scheduledAt, "2026-11-16T07:00:00.000Z");
  } finally {
    s.DB.sqlite.close();
    t.mock.timers.reset();
  }
});
test("reschedule/cancel invalidate queued old events; retries preserve manual edits and mismatched keys conflict", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const a = await s.read(),
      body = {
        schedule: {
          mode: "absolute",
          scheduledAt: new Date(NOW + 120000).toISOString(),
        },
        expectedSettingsVersion: a.settingsVersion,
      };
    assert.equal((await s.call("PUT", body)).status, 200);
    t.mock.timers.setTime(NOW + 120000);
    await s.worker.scheduled({}, s.env);
    // Plan creates delivery jobs, then cancellation must be rechecked by the delivery consumer.
    const plan = s.queue.shift();
    await s.worker.queue(
      {
        messages: [
          {
            body: plan,
            ack() {},
            retry() {
              throw Error("unexpected retry");
            },
          },
        ],
      },
      s.env,
    );
    assert.equal(s.queue.length, 1);
    const b = await s.read();
    const cancelled = await s.call(
      "DELETE",
      undefined,
      "cancel-reminder-0001",
      s.key.key,
      b.settingsVersion,
    );
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).result.status, "disabled");
    await s.drain();
    assert.equal(s.sent.length, 0);
    assert.equal((await s.call("PUT", body)).status, 200);
    assert.equal((await s.read()).disabled, true);
    assert.equal(
      (await s.call("PUT", { ...body, disabled: false })).status,
      409,
    );
  } finally {
    s.DB.sqlite.close();
    t.mock.timers.reset();
  }
});
test("future validation, missing idempotency/version, scopes and cross-account isolation fail closed", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const old = await s.read(),
      schedule = {
        mode: "absolute",
        scheduledAt: new Date(NOW + 120000).toISOString(),
      };
    assert.equal(
      (
        await s.call(
          "PUT",
          { schedule, expectedSettingsVersion: old.settingsVersion },
          "",
        )
      ).status,
      400,
    );
    assert.equal(
      (await s.call("PUT", { schedule }, "missing-version-key-0001")).status,
      422,
    );
    assert.equal(
      (
        await s.call(
          "PUT",
          {
            schedule: {
              ...schedule,
              scheduledAt: new Date(NOW - 60000).toISOString(),
            },
            expectedSettingsVersion: old.settingsVersion,
          },
          "past-time-key-0001",
        )
      ).status,
      409,
    );
    const bob = await manageApiKeys(s.env, "bob", {
      action: "create",
      name: "Other owner",
      scopes: s.scopes,
    });
    assert.equal(
      (
        await s.call(
          "PUT",
          { schedule, expectedSettingsVersion: old.settingsVersion },
          "bob-reminder-key-0001",
          bob.key,
        )
      ).status,
      404,
    );
    const readOnly = await manageApiKeys(s.env, "alice", {
      action: "create",
      name: "Read only",
      scopes: ["reminders:read"],
    });
    assert.equal(
      (
        await s.call(
          "PUT",
          { schedule, expectedSettingsVersion: old.settingsVersion },
          "readonly-key-0001",
          readOnly.key,
        )
      ).status,
      403,
    );
    assert.equal(
      (await s.DB.prepare("SELECT COUNT(*) AS n FROM cards").first()).n,
      0,
    );
  } finally {
    s.DB.sqlite.close();
    t.mock.timers.reset();
  }
});
test("native authenticated card settings can be configured with no local Push permission and share the API view/CAS", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const request = (data) =>
      s.worker.fetch(
        new Request("https://worker.example/", {
          method: "POST",
          headers: {
            origin: "https://app.example",
            "content-type": "application/json",
          },
          body: JSON.stringify(data),
        }),
        s.env,
      );
    const status = await (
      await request({ action: "card-status", projectId: ID })
    ).json();
    assert.equal(
      status.result.settingsVersion,
      (await s.read()).settingsVersion,
    );
    const body = {
      action: "card",
      projectId: ID,
      disabled: false,
      weekly: false,
      time: "",
      schedule: {
        mode: "absolute",
        scheduledAt: new Date(NOW + 300000).toISOString(),
      },
      settingsVersion: status.result.settingsVersion,
    };
    const save = await request(body);
    assert.equal(save.status, 200);
    assert.equal((await save.json()).result.status, "scheduled");
    assert.equal(
      (
        await request({
          ...body,
          schedule: {
            ...body.schedule,
            scheduledAt: new Date(NOW + 600000).toISOString(),
          },
        })
      ).status,
      409,
    );
  } finally {
    s.DB.sqlite.close();
    t.mock.timers.reset();
  }
});

test("explicit schedules defer to account quiet hours and do not overlap automatic due reminders", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    await s.DB.prepare("UPDATE accounts SET prefs=? WHERE uid=?")
      .bind(
        JSON.stringify({
          ...s.p,
          due: true,
          quiet: true,
          quietStart: "13:00",
          quietEnd: "16:00",
        }),
        "alice",
      )
      .run();
    const state = await s.read();
    assert.equal(
      (
        await s.call("PUT", {
          disabled: false,
          expectedSettingsVersion: state.settingsVersion,
          schedule: {
            mode: "absolute",
            scheduledAt: new Date(NOW + 120000).toISOString(),
          },
        })
      ).status,
      200,
    );
    const configured = await s.read();
    assert.equal(configured.scheduledAt, "2026-11-08T12:02:00.000Z");
    assert.equal(configured.effectiveAt, "2026-11-08T14:00:00.000Z");
    t.mock.timers.setTime(NOW + 120000);
    await s.worker.scheduled({}, s.env);
    await s.drain();
    assert.equal(s.sent.length, 0);
    t.mock.timers.setTime(NOW + 2 * 3600000);
    await s.worker.scheduled({}, s.env);
    await s.drain();
    assert.equal(s.sent.length, 1);
    await s.worker.scheduled({}, s.env);
    await s.drain();
    assert.equal(s.sent.length, 1);
  } finally {
    s.DB.sqlite.close();
    t.mock.timers.reset();
  }
});

test("concurrent reuse of an operation key cannot mutate two different cards", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const second = "q".repeat(20);
    s.repository.seed("projects", second, {
      ...s.repository.get("projects", ID),
      id: second,
    });
    const version = (await s.read()).settingsVersion,
      body = {
        expectedSettingsVersion: version,
        schedule: {
          mode: "absolute",
          scheduledAt: new Date(NOW + 300000).toISOString(),
        },
      };
    const request = (id) =>
      s.handler(
        new Request("https://api.example/api/v1/reminders/" + id, {
          method: "PUT",
          headers: {
            authorization: "Bearer " + s.key.key,
            "content-type": "application/json",
            "idempotency-key": "concurrent-shared-operation-0001",
          },
          body: JSON.stringify(body),
        }),
        s.env,
      );
    const responses = await Promise.all([request(ID), request(second)]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      (
        await s.DB.prepare("SELECT COUNT(*) AS n FROM cards WHERE uid=?")
          .bind("alice")
          .first()
      ).n,
      1,
    );
  } finally {
    s.DB.sqlite.close();
    t.mock.timers.reset();
  }
});

test("group reminders are personal to a member even for another assignee; automatic defaults stay assignment-scoped", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: NOW });
  const s = await setup();
  try {
    const group = "g".repeat(20);
    s.repository.seed("projects", ID, {
      ...s.repository.get("projects", ID),
      status: "active",
      assignedTo: "bob",
      dueDate: "2026-11-08",
    });
    await s.DB.prepare("INSERT INTO scopes(uid,scope,next_at) VALUES(?,?,?)")
      .bind("alice", group, NOW)
      .run();
    await s.worker.scheduled({}, s.env);
    await s.drain();
    assert.equal(s.sent.length, 0);
    const request = (data) =>
      s.worker.fetch(
        new Request("https://worker.example/", {
          method: "POST",
          headers: {
            origin: "https://app.example",
            "content-type": "application/json",
          },
          body: JSON.stringify(data),
        }),
        s.env,
      );
    const before = await (
      await request({ action: "card-status", projectId: ID, groupId: group })
    ).json();
    const response = await request({
      action: "card",
      projectId: ID,
      groupId: group,
      disabled: false,
      weekly: false,
      time: "09:00",
      schedule: {
        mode: "absolute",
        scheduledAt: new Date(NOW + 120000).toISOString(),
      },
      settingsVersion: before.result.settingsVersion,
    });
    assert.equal(response.status, 200);
    t.mock.timers.setTime(NOW + 120000);
    await s.worker.scheduled({}, s.env);
    await s.drain();
    assert.equal(s.sent.length, 1);
    assert.equal(s.sent[0].uid, "alice");
    assert.equal(
      (
        await s.DB.prepare("SELECT COUNT(*) AS n FROM cards WHERE uid=?")
          .bind("bob")
          .first()
      ).n,
      0,
    );
  } finally {
    s.DB.sqlite.close();
    t.mock.timers.reset();
  }
});
