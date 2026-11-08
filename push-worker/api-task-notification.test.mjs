import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { database } from "./test-db.mjs";
import { defaults } from "./policy.mjs";
import { manageApiKeys } from "./src/apiKeys.mjs";
import { createApiHandler } from "./src/apiEndpoint.mjs";
import { createWorker } from "./src/index.mjs";
import { createTaskNotificationStore } from "./src/apiTaskNotificationStore.mjs";
import { createTaskNotificationService } from "./src/apiTaskNotification.mjs";
import { MemoryRepository } from "../tests/helpers/apiMemoryRepository.mjs";
async function fixture() {
  const DB = database();
  for (const name of ["api-schema.sql", "reminder-link-schema.sql"])
    DB.sqlite.exec(readFileSync(new URL(name, import.meta.url), "utf8"));
  const queue = [],
    sent = [],
    env = {
      DB,
      PUBLIC_API_ENABLED: "true",
      PUSH_QUEUE: {
        async send(body) {
          queue.push(body);
        },
      },
    },
    repository = new MemoryRepository("alice");
  for (const [kind, item] of [
    [
      "courses",
      {
        id: "course",
        name: "Course",
        url: "",
        notes: "",
        requires: [],
        topics: [],
        x: 0,
        y: 0,
      },
    ],
    [
      "tasks",
      {
        id: "task",
        courseId: "course",
        title: "Trusted assignment",
        kind: "assignment",
        due: new Date(Date.now() + 10 * 86400000).toISOString(),
        notes: "",
        url: "",
        done: false,
      },
    ],
  ])
    repository.seed("studyRecords", kind + "_" + item.id, {
      kind,
      id: item.id,
      payload: JSON.stringify(item),
      deleted: false,
      revision: 0,
      mutationId: "seed",
    });
  const scopes = [
      "courses:read",
      "tasks:read",
      "reminders:read",
      "reminders:write",
    ],
    key = await manageApiKeys(env, "alice", {
      action: "create",
      name: "Synthetic",
      scopes,
    });
  const prefs = {
    ...defaults,
    enabled: true,
    quiet: false,
    hideContent: false,
    timezone: "Asia/Jerusalem",
  };
  await DB.prepare(
    "UPDATE accounts SET prefs=?,enabled=1,enabled_at=? WHERE uid=?",
  )
    .bind(JSON.stringify(prefs), Date.now() - 86400000, "alice")
    .run();
  await DB.prepare("INSERT INTO devices(id,uid,subscription) VALUES(?,?,?)")
    .bind(
      "alice-phone",
      "alice",
      JSON.stringify({
        endpoint: "https://fcm.googleapis.com/fcm/send/SYNTHETIC-only",
        keys: {},
      }),
    )
    .run();
  const send = async (_env, subscription, payload) =>
    sent.push({ subscription, payload });
  const repos = { alice: repository, bob: new MemoryRepository("bob") };
  const handler = createApiHandler({
    assertAccount: async () => {},
    repository: (_, uid) => repos[uid],
  });
  const worker = createWorker({
    accountAvailable: async () => {},
    scopeProjects: async () => [],
    sendPush: send,
    publicApi: { repository: (_, uid) => repos[uid] },
  });
  const request = (
    token = key.key,
    method = "POST",
    body = { expectedRevision: 0 },
    idem = "synthetic-notification-key-0001",
    path = "notification",
  ) =>
    new Request("https://api.example/api/v1/tasks/task/" + path, {
      method,
      headers: {
        authorization: "Bearer " + token,
        "content-type": "application/json",
        "idempotency-key": idem,
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(body) }),
    });
  const drain = async () => {
    while (queue.length) {
      const body = queue.shift();
      let retried = false;
      await worker.queue(
        {
          messages: [
            {
              body,
              ack() {},
              retry() {
                retried = true;
              },
            },
          ],
        },
        env,
      );
      assert.equal(retried, false);
    }
  };
  return {
    DB,
    env,
    repository,
    repos,
    queue,
    sent,
    handler,
    worker,
    key,
    scopes,
    prefs,
    request,
    drain,
    send,
  };
}
test("Public API -> durable D1 -> native Worker queue -> existing Push sender; stable task event deduplicates keys and retries", async () => {
  const s = await fixture();
  try {
    const first = await s.handler(s.request(), s.env);
    assert.equal(first.status, 202);
    assert.equal((await first.json()).result.handsetDelivery, "not-confirmed");
    assert.equal((await s.handler(s.request(), s.env)).status, 202);
    assert.equal(s.queue.length, 1);
    await s.drain();
    assert.equal(s.sent.length, 1);
    assert.equal(s.sent[0].payload.uid, "alice");
    assert.equal(s.sent[0].payload.body, "Trusted assignment");
    assert.match(s.sent[0].payload.url, /courseId=course/);
    const status = await (
      await s.handler(s.request(s.key.key, "GET"), s.env)
    ).json();
    assert.equal(status.result.status, "provider-accepted");
    assert.equal(status.result.providerAccepted, 1);
    assert.equal(status.result.handsetDelivery, "not-confirmed");
    assert.equal(
      (
        await s.handler(
          s.request(
            s.key.key,
            "POST",
            { expectedRevision: 0 },
            "another-notification-key-0002",
          ),
          s.env,
        )
      ).status,
      200,
    );
    await s.drain();
    assert.equal(s.sent.length, 1);
    await s.worker.queue(
      {
        messages: [
          {
            body: { type: "task-notification", uid: "alice", taskId: "task" },
            ack() {},
            retry() {
              throw Error("unexpected retry");
            },
          },
        ],
      },
      s.env,
    );
    assert.equal(s.sent.length, 1);
    assert.equal(
      (
        await s.handler(
          s.request(s.key.key, "POST", { expectedRevision: 2 }),
          s.env,
        )
      ).status,
      409,
    );
  } finally {
    s.DB.sqlite.close();
  }
});
test("scopes, invalid keys, revoked keys, foreign assignments and arbitrary messages are rejected without enqueue", async () => {
  const s = await fixture();
  try {
    assert.equal((await s.handler(s.request("invalid"), s.env)).status, 401);
    for (const missing of ["courses:read", "tasks:read", "reminders:write"]) {
      const k = await manageApiKeys(s.env, "alice", {
        action: "create",
        name: "Restricted",
        scopes: s.scopes.filter((v) => v !== missing),
      });
      assert.equal((await s.handler(s.request(k.key), s.env)).status, 403);
    }
    const bob = await manageApiKeys(s.env, "bob", {
      action: "create",
      name: "Other owner",
      scopes: s.scopes,
    });
    assert.equal((await s.handler(s.request(bob.key), s.env)).status, 404);
    assert.equal(
      (await s.handler(s.request(bob.key, "GET"), s.env)).status,
      404,
    );
    assert.equal(
      (
        await s.handler(
          s.request(s.key.key, "POST", {
            expectedRevision: 0,
            message: "Untrusted text",
          }),
          s.env,
        )
      ).status,
      422,
    );
    await manageApiKeys(s.env, "alice", {
      action: "revoke",
      id: s.key.metadata.id,
    });
    assert.equal((await s.handler(s.request(), s.env)).status, 401);
    assert.equal(s.queue.length, 0);
  } finally {
    s.DB.sqlite.close();
  }
});
test("queue acknowledgement loss recovers on the existing cron without duplicate provider calls", async () => {
  const s = await fixture();
  try {
    const original = s.env.PUSH_QUEUE.send;
    s.env.PUSH_QUEUE.send = async (body) => {
      s.queue.push(body);
      throw Error("lost queue acknowledgement");
    };
    assert.equal((await s.handler(s.request(), s.env)).status, 202);
    await s.DB.prepare("UPDATE api_task_notifications SET next_at=0").run();
    s.env.PUSH_QUEUE.send = original;
    await s.worker.scheduled({}, s.env);
    assert.equal(s.queue.length, 2);
    await s.drain();
    assert.equal(s.sent.length, 1);
  } finally {
    s.DB.sqlite.close();
  }
});
test("quiet hours defer; opt-out and private content are respected at delivery", async () => {
  const s = await fixture();
  try {
    const p = {
      ...s.prefs,
      quiet: true,
      quietStart: "00:00",
      quietEnd: "23:59",
      hideContent: true,
    };
    await s.DB.prepare("UPDATE accounts SET prefs=? WHERE uid=?")
      .bind(JSON.stringify(p), "alice")
      .run();
    assert.equal(
      (await (await s.handler(s.request(), s.env)).json()).result.status,
      "deferred",
    );
    await s.drain();
    assert.equal(s.sent.length, 0);
    p.quiet = false;
    await s.DB.prepare("UPDATE accounts SET prefs=? WHERE uid=?")
      .bind(JSON.stringify(p), "alice")
      .run();
    await s.DB.prepare("UPDATE api_task_notifications SET next_at=0").run();
    await s.worker.scheduled({}, s.env);
    await s.drain();
    assert.equal(s.sent.length, 1);
    assert.notEqual(s.sent[0].payload.body, "Trusted assignment");
  } finally {
    s.DB.sqlite.close();
  }
});
test("unknown network outcome and a crash after sending are not automatically resent", async () => {
  const s = await fixture();
  try {
    await s.handler(s.request(), s.env);
    let calls = 0;
    const notifications = createTaskNotificationStore(s.env, "alice", {
      send: async () => {
        calls++;
        throw Error("connection lost");
      },
    });
    const service = createTaskNotificationService({
      repository: s.repository,
      notifications,
      ownerUid: "alice",
    });
    await service.deliver("task");
    assert.equal((await service.status("task")).status, "unknown");
    await service.deliver("task");
    assert.equal(calls, 1);
  } finally {
    s.DB.sqlite.close();
  }
  const c = await fixture();
  try {
    await c.handler(c.request(), c.env);
    await c.DB.prepare(
      "INSERT INTO api_task_notification_deliveries(uid,task_id,device_id,state,started_at) VALUES('alice','tasks:task','alice-phone','sending',?)",
    )
      .bind(Date.now() - 130000)
      .run();
    await c.drain();
    assert.equal(c.sent.length, 0);
    assert.equal(
      (await (await c.handler(c.request(c.key.key, "GET"), c.env)).json())
        .result.status,
      "unknown",
    );
  } finally {
    c.DB.sqlite.close();
  }
});
test("disabled preferences, missing devices, stale revision and a deleted course fail closed", async () => {
  for (const scenario of ["disabled", "devices", "revision", "course"]) {
    const s = await fixture();
    try {
      if (scenario === "disabled")
        await s.DB.prepare("UPDATE accounts SET prefs=?")
          .bind(JSON.stringify({ ...s.prefs, enabled: false }))
          .run();
      if (scenario === "devices")
        await s.DB.prepare("DELETE FROM devices").run();
      if (scenario === "course") {
        const rec = s.repository.get("studyRecords", "courses_course");
        s.repository.seed("studyRecords", "courses_course", {
          ...rec,
          deleted: true,
        });
      }
      const response = await s.handler(
        s.request(s.key.key, "POST", {
          expectedRevision: scenario === "revision" ? 99 : 0,
        }),
        s.env,
      );
      assert.equal(response.status, 409);
      assert.equal(s.queue.length, 0);
    } finally {
      s.DB.sqlite.close();
    }
  }
});

test("personal non-task notifications enforce ownership, inclusion, scopes and stable resource deduplication", async () => {
  const s = await fixture();
  try {
    const id = "b".repeat(20);
    s.repository.seed("projects", id, {
      name: "Trusted book",
      kind: "resource",
      resourceType: "book",
      status: "done",
      dueDate: "",
      revision: 0,
    });
    const key = await manageApiKeys(s.env, "alice", {
      action: "create",
      name: "Cards",
      scopes: ["projects:read", "reminders:read", "reminders:write"],
    });
    const req = (token = key.key, method = "POST") =>
      new Request(
        "https://api.example/api/v1/projects/" + id + "/notification",
        {
          method,
          headers: {
            authorization: "Bearer " + token,
            "content-type": "application/json",
            "idempotency-key": "synthetic-card-notification-0001",
          },
          ...(method === "GET"
            ? {}
            : { body: JSON.stringify({ expectedRevision: 0 }) }),
        },
      );
    assert.equal((await s.handler(req(s.key.key), s.env)).status, 403);
    await s.DB.prepare("INSERT INTO cards(uid,id,settings) VALUES(?,?,?)")
      .bind("alice", "personal__" + id, JSON.stringify({ disabled: true }))
      .run();
    assert.equal((await s.handler(req(), s.env)).status, 409);
    assert.equal(s.queue.length, 0);
    await s.DB.prepare("UPDATE cards SET settings=? WHERE uid=?")
      .bind("{}", "alice")
      .run();
    const bob = await manageApiKeys(s.env, "bob", {
      action: "create",
      name: "Other owner",
      scopes: ["projects:read", "reminders:write"],
    });
    assert.equal((await s.handler(req(bob.key), s.env)).status, 404);
    assert.equal((await s.handler(req(), s.env)).status, 202);
    await s.drain();
    assert.equal(s.sent.length, 1);
    assert.equal(s.sent[0].payload.body, "Trusted book");
    assert.equal(
      (await (await s.handler(req(key.key, "GET"), s.env)).json()).result
        .providerAccepted,
      1,
    );
    assert.equal((await s.handler(req(), s.env)).status, 200);
    await s.drain();
    assert.equal(s.sent.length, 1);
  } finally {
    s.DB.sqlite.close();
  }
});

test("real native Web Push encryption and VAPID signing reach a synthetic provider only", async (t) => {
  const s = await fixture();
  try {
    const webpush = (await import("web-push")).default,
      vapid = webpush.generateVAPIDKeys();
    Object.assign(s.env, {
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
      VAPID_SUBJECT: "mailto:synthetic@example.test",
    });
    const pair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const publicKey = Buffer.from(
      await crypto.subtle.exportKey("raw", pair.publicKey),
    ).toString("base64url");
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/SYNTHETIC-only",
      keys: {
        p256dh: publicKey,
        auth: Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
          "base64url",
        ),
      },
    };
    await s.DB.prepare("UPDATE devices SET subscription=? WHERE id=?")
      .bind(JSON.stringify(subscription), "alice-phone")
      .run();
    let calls = 0;
    t.mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(url, subscription.endpoint);
      assert.equal(init.redirect, "manual");
      assert.ok(init.headers);
      assert.ok(init.body);
      assert.equal(
        Buffer.from(init.body).includes(Buffer.from("Trusted assignment")),
        false,
      );
      calls++;
      return new Response(null, { status: 201 });
    });
    await s.handler(s.request(), s.env);
    const notifications = createTaskNotificationStore(s.env, "alice");
    const service = createTaskNotificationService({
      repository: s.repository,
      notifications,
      ownerUid: "alice",
    });
    await service.deliver("task");
    assert.equal(calls, 1);
    assert.equal((await service.status("task")).status, "provider-accepted");
    assert.equal(
      (await service.status("task")).handsetDelivery,
      "not-confirmed",
    );
    await service.deliver("task");
    assert.equal(calls, 1);
  } finally {
    s.DB.sqlite.close();
  }
});

test("quiet-hours override is owner-managed, per-key, explicit, auditable and promotes one deferred event without duplication", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-11-09T12:00:00Z"),
  });
  const s = await fixture();
  try {
    const p = {
      ...s.prefs,
      quiet: true,
      quietStart: "00:00",
      quietEnd: "23:59",
    };
    await s.DB.prepare("UPDATE accounts SET prefs=? WHERE uid=?")
      .bind(JSON.stringify(p), "alice")
      .run();
    const body = { expectedRevision: 0, bypassQuietHours: true };
    const denied = await s.handler(s.request(s.key.key, "POST", body), s.env);
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error, "quiet-hours-override-forbidden");
    assert.equal(s.queue.length, 0);
    await manageApiKeys(s.env, "alice", {
      action: "update",
      id: s.key.metadata.id,
      quietHoursOverride: true,
    });
    const listed = await manageApiKeys(s.env, "alice", { action: "list" });
    assert.equal(listed.keys[0].quietHoursOverride, true);
    assert.deepEqual(listed.keys[0].scopes, s.scopes);
    await assert.rejects(
      manageApiKeys(s.env, "bob", {
        action: "update",
        id: s.key.metadata.id,
        quietHoursOverride: true,
      }),
      /key-not-found/,
    );
    const other = await manageApiKeys(s.env, "alice", {
      action: "create",
      name: "Unrelated",
      scopes: s.scopes,
    });
    assert.equal(other.metadata.quietHoursOverride, false);
    assert.equal(
      (await s.handler(s.request(other.key, "POST", body), s.env)).status,
      403,
    );
    const first = await (await s.handler(s.request(), s.env)).json();
    assert.equal(first.result.status, "deferred");
    await s.drain();
    assert.equal(s.sent.length, 0);
    assert.equal(
      (await s.handler(s.request(s.key.key, "POST", body), s.env)).status,
      409,
    );
    const promoted = await (
      await s.handler(
        s.request(s.key.key, "POST", body, "promote-deferred-operation-0001"),
        s.env,
      )
    ).json();
    assert.equal(promoted.result.eventId, first.result.eventId);
    assert.equal(promoted.result.quietHoursOverrideEffective, true);
    await s.drain();
    assert.equal(s.sent.length, 1);
    await s.handler(
      s.request(s.key.key, "POST", body, "promote-deferred-operation-0001"),
      s.env,
    );
    await s.drain();
    assert.equal(s.sent.length, 1);
    const audit = await s.DB.prepare(
      "SELECT COUNT(*) AS n FROM api_audit WHERE uid='alice' AND operation LIKE '%quiet-override%'",
    ).first();
    assert.ok(audit.n > 0);
    const rotated = await manageApiKeys(s.env, "alice", {
      action: "rotate",
      id: s.key.metadata.id,
    });
    assert.equal(rotated.metadata.quietHoursOverride, true);
    assert.deepEqual(
      JSON.parse(
        (
          await s.DB.prepare("SELECT prefs FROM accounts WHERE uid=?")
            .bind("alice")
            .first()
        ).prefs,
      ),
      p,
    );
  } finally {
    s.DB.sqlite.close();
    t.mock.timers.reset();
  }
});
test("revoking override before dispatch restores quiet hours; account opt-out and device withdrawal remain authoritative", async (t) => {
  t.mock.timers.enable({
    apis: ["Date"],
    now: Date.parse("2026-11-09T12:00:00Z"),
  });
  for (const action of ["permission", "account", "device"]) {
    const s = await fixture();
    try {
      await s.DB.prepare("UPDATE accounts SET prefs=? WHERE uid=?")
        .bind(
          JSON.stringify({
            ...s.prefs,
            quiet: true,
            quietStart: "00:00",
            quietEnd: "23:59",
          }),
          "alice",
        )
        .run();
      await manageApiKeys(s.env, "alice", {
        action: "update",
        id: s.key.metadata.id,
        quietHoursOverride: true,
      });
      const body = { expectedRevision: 0, bypassQuietHours: true };
      assert.equal(
        (await s.handler(s.request(s.key.key, "POST", body), s.env)).status,
        202,
      );
      if (action === "permission") {
        await manageApiKeys(s.env, "alice", {
          action: "update",
          id: s.key.metadata.id,
          quietHoursOverride: false,
        });
        assert.equal(
          (
            await s.handler(
              s.request(
                s.key.key,
                "POST",
                body,
                "revoked-override-request-0002",
              ),
              s.env,
            )
          ).status,
          403,
        );
      }
      if (action === "account")
        await s.DB.prepare("UPDATE accounts SET prefs=? WHERE uid=?")
          .bind(JSON.stringify({ ...s.prefs, enabled: false }), "alice")
          .run();
      if (action === "device")
        await s.DB.prepare("DELETE FROM devices WHERE uid=?")
          .bind("alice")
          .run();
      await s.drain();
      assert.equal(s.sent.length, 0);
      if (action === "permission") {
        const replacement = await manageApiKeys(s.env, "alice", {
          action: "rotate",
          id: s.key.metadata.id,
        });
        await manageApiKeys(s.env, "alice", {
          action: "update",
          id: replacement.metadata.id,
          quietHoursOverride: true,
        });
        const old = (
          await (
            await s.handler(s.request(replacement.key, "GET"), s.env)
          ).json()
        ).result.eventId;
        assert.equal(
          (
            await s.handler(
              s.request(
                replacement.key,
                "POST",
                body,
                "replacement-promote-key-0001",
              ),
              s.env,
            )
          ).status,
          202,
        );
        await s.drain();
        assert.equal(s.sent.length, 1);
        assert.equal(
          (
            await (
              await s.handler(s.request(replacement.key, "GET"), s.env)
            ).json()
          ).result.eventId,
          old,
        );
      }
    } finally {
      s.DB.sqlite.close();
    }
  }
  t.mock.timers.reset();
});
