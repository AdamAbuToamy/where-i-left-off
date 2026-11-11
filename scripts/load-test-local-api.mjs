/** Local-only load harness: SQLite memory, injected repositories/Push. No HTTP networking. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { database } from "../push-worker/test-db.mjs";
import { manageApiKeys } from "../push-worker/src/apiKeys.mjs";
import { createApiHandler } from "../push-worker/src/apiEndpoint.mjs";
import { createWorker } from "../push-worker/src/index.mjs";
import { defaults, localParts } from "../push-worker/policy.mjs";
import { MemoryRepository } from "../tests/helpers/apiMemoryRepository.mjs";
const db = database();
db.sqlite.exec(
  readFileSync(
    new URL("../push-worker/api-schema.sql", import.meta.url),
    "utf8",
  ),
);
const env = {
  DB: db,
  PUBLIC_API_ENABLED: "true",
  APP_ORIGINS: "https://synthetic.invalid",
};
const repositories = new Map();
const handler = createApiHandler({
  assertAccount: async () => {},
  repository: (_, uid) => {
    if (!repositories.has(uid))
      repositories.set(uid, new MemoryRepository(uid));
    return repositories.get(uid);
  },
});
const request = (secret, path = "courses", method = "GET", body, id) =>
  new Request("https://synthetic.invalid/api/v1/" + path, {
    method,
    headers: {
      authorization: "Bearer " + secret,
      "content-type": "application/json",
      ...(id ? { "idempotency-key": id } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
const durations = [],
  counts = {};
async function call(secret, path, method, body, id) {
  const start = performance.now();
  const response = await handler(request(secret, path, method, body, id), env);
  durations.push(performance.now() - start);
  counts[response.status] = (counts[response.status] || 0) + 1;
  return { status: response.status, body: await response.json() };
}
const start = performance.now();
const realNow = Date.now,
  frozenNow = realNow();
Date.now = () => frozenNow;
try {
  const keys = [];
  for (let n = 0; n < 20; n++)
    keys.push(
      await manageApiKeys(env, "synthetic-" + n, {
        action: "create",
        name: "Ephemeral local load",
        scopes: ["courses:read", "courses:write"],
      }),
    );
  for (let round = 0; round < 50; round++)
    await Promise.all(
      keys.map(async (k) => assert.equal((await call(k.key)).status, 200)),
    );
  const rate = await manageApiKeys(env, "synthetic-rate", {
    action: "create",
    name: "Ephemeral rate probe",
    scopes: ["courses:read"],
  });
  const rateResults = await Promise.all(
    Array.from({ length: 80 }, () => call(rate.key)),
  );
  assert.equal(rateResults.filter((r) => r.status === 200).length, 60);
  assert.equal(rateResults.filter((r) => r.status === 429).length, 20);
  const replay = await manageApiKeys(env, "synthetic-replay", {
    action: "create",
    name: "Ephemeral replay probe",
    scopes: ["courses:read", "courses:write"],
  });
  const results = await Promise.all(
    Array.from({ length: 4 }, () =>
      call(
        replay.key,
        "courses",
        "POST",
        { values: { name: "Synthetic replay course" } },
        "synthetic-load-replay-0001",
      ),
    ),
  );
  for (const r of results) assert.equal(r.status, 201);
  assert.equal(new Set(results.map((r) => r.body.result.id)).size, 1);
  assert.equal(
    (await call(keys[1].key, "courses/" + results[0].body.result.id)).status,
    404,
  );
  const restricted = await manageApiKeys(env, "synthetic-scope", {
    action: "create",
    name: "Ephemeral scope probe",
    scopes: ["courses:write"],
  });
  assert.equal((await call(restricted.key)).status, 403);
  await manageApiKeys(env, "synthetic-replay", {
    action: "revoke",
    id: replay.metadata.id,
  });
  assert.equal((await call(replay.key)).status, 401);
  const scheduler = database(),
    messages = [],
    sent = [];
  try {
    const now = Date.now(),
      projects = Array.from({ length: 300 }, (_, i) => ({
        id: ("synthetic" + i).padEnd(20, "x"),
        name: "Synthetic card",
        status: "later",
        dueDate: new Date(now).toISOString().slice(0, 10),
        activityAt: 1,
      }));
    const pushEnv = {
      DB: scheduler,
      APP_ORIGINS: "https://synthetic.invalid",
      VAPID_PUBLIC_KEY: "synthetic",
      PUSH_QUEUE: {
        send: async (body) => messages.push(body),
        sendBatch: async (batch) => messages.push(...batch.map((m) => m.body)),
      },
    };
    const worker = createWorker({
      verifyIdentity: async () => ({
        uid: "synthetic-scheduler",
        token: "synthetic",
      }),
      accountAvailable: async () => {},
      readCollection: async () => [],
      readDocument: async () => null,
      scopeProjects: async () => projects,
      cardDocument: async (_, uid, id) => projects.find((p) => p.id === id),
      sendPush: async (_, subscription, payload) =>
        sent.push({ subscription, payload }),
    });
    const configure = async (body) => {
      const response = await worker.fetch(
        new Request("https://synthetic.invalid/", {
          method: "POST",
          headers: {
            origin: "https://synthetic.invalid",
            authorization: "Bearer synthetic",
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        }),
        pushEnv,
      );
      assert.equal(response.status, 200);
    };
    await configure({
      action: "subscribe",
      subscription: {
        endpoint: "https://fcm.googleapis.com/fcm/send/synthetic-local-only",
        keys: { auth: "a".repeat(22), p256dh: "b".repeat(87) },
      },
    });
    await configure({
      action: "save",
      preferences: {
        ...defaults,
        enabled: true,
        quiet: false,
        timezone: "UTC",
        defaultTime: localParts(now - 60000, "UTC").time,
      },
    });
    scheduler.sqlite
      .prepare("UPDATE accounts SET enabled_at=?")
      .run(now - 3600000);
    const deliveredIds = new Set();
    const drain = async () => {
      while (messages.length) {
        const body = messages.shift();
        const before = sent.length;
        await worker.queue(
          {
            messages: [
              {
                body,
                ack() {},
                retry() {
                  throw Error("Unexpected synthetic retry");
                },
              },
            ],
          },
          pushEnv,
        );
        if (sent.length > before) {
          assert.ok(
            !deliveredIds.has(body.projectId),
            "Duplicate logical dispatch",
          );
          deliveredIds.add(body.projectId);
        }
      }
    };
    await worker.scheduled({}, pushEnv);
    await drain();
    const first = sent.length;
    assert.ok(first > 0);
    await worker.scheduled({}, pushEnv);
    await drain();
    assert.equal(sent.length, first);
    const immediateReplayExtra = sent.length - first;
    let ticks = 1;
    while (sent.length < projects.length && ticks < 50) {
      scheduler.sqlite.prepare("UPDATE scopes SET next_at=0").run();
      await worker.scheduled({}, pushEnv);
      await drain();
      ticks++;
    }
    assert.equal(sent.length, projects.length);
    assert.equal(deliveredIds.size, projects.length);
    durations.sort((a, b) => a - b);
    const percentile = (p) =>
      Number(
        durations[
          Math.min(durations.length - 1, Math.floor(durations.length * p))
        ].toFixed(2),
      );
    const report = {
      kind: "local-injected-load-not-provider-capacity",
      at: new Date().toISOString(),
      apiRequests: durations.length,
      syntheticAccounts: 23,
      concurrency: 20,
      statusCounts: counts,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
      elapsedMs: Math.round(performance.now() - start),
      rateLimit: { accepted: 60, rejected: 20 },
      sameIdempotencyKeyResourceCount: 1,
      schedulerInputCards: projects.length,
      firstTickDispatches: first,
      syntheticDispatches: sent.length,
      uniqueDispatchedCards: deliveredIds.size,
      simulatedDueTicks: ticks,
      replayedSchedulerAdditionalDispatches: immediateReplayExtra,
      realNetworkRequests: 0,
      productionWrites: 0,
    };
    if (process.argv[2])
      writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    scheduler.sqlite.close();
  }
} finally {
  Date.now = realNow;
  db.sqlite.close();
}
