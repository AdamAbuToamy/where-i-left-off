import { ApiError } from "../shared/universityApiPlan.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { database } from "./test-db.mjs";
import { manageApiKeys } from "./src/apiKeys.mjs";
import { authenticateApi } from "./src/apiSecurity.mjs";
import { createApiHandler } from "./src/apiEndpoint.mjs";
import { createWorker } from "./src/index.mjs";
import { MemoryRepository } from "../tests/helpers/apiMemoryRepository.mjs";
function setup() {
  const DB = database();
  DB.sqlite.exec(
    readFileSync(new URL("./api-schema.sql", import.meta.url), "utf8"),
  );
  const env = {
    DB,
    APP_ORIGINS: "https://app.example",
    PUBLIC_API_ENABLED: "true",
  };
  return { env, close: () => DB.sqlite.close() };
}
async function key(env, uid, scopes) {
  return manageApiKeys(env, uid, {
    action: "create",
    name: "Synthetic automation",
    scopes,
  });
}
const request = (
  secret,
  path,
  method = "GET",
  body,
  key = "synthetic-request-00001",
) =>
  new Request("https://api.example/api/v1/" + path, {
    method,
    headers: {
      authorization: "Bearer " + secret,
      "content-type": "application/json",
      "idempotency-key": key,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
test("keys are random, hash-only, owner bound, scoped, one-time and revocable", async () => {
  const { env, close } = setup();
  try {
    const k = await key(env, "alice", ["courses:read"]);
    assert.match(k.key, /^wilo_api_/);
    const row = await env.DB.prepare("SELECT * FROM user_api_keys").first();
    assert.equal(row.digest.length, 64);
    assert.ok(!JSON.stringify(row).includes(k.key));
    const listed = await manageApiKeys(env, "alice", { action: "list" });
    assert.equal(listed.keys.length, 1);
    assert.ok(!JSON.stringify(listed).includes(k.key));
    assert.equal(
      (await authenticateApi(request(k.key, "courses"), env)).uid,
      "alice",
    );
    assert.equal(
      (await manageApiKeys(env, "bob", { action: "list" })).keys.length,
      0,
    );
    await assert.rejects(
      manageApiKeys(env, "bob", { action: "revoke", id: k.metadata.id }),
      /key-not-found/,
    );
    await manageApiKeys(env, "alice", { action: "revoke", id: k.metadata.id });
    await assert.rejects(
      authenticateApi(request(k.key, "courses"), env),
      /unauthenticated/,
    );
  } finally {
    close();
  }
});
test("rotation atomically revokes old key, preserves scopes; expiry and unknown scopes fail", async () => {
  const { env, close } = setup();
  try {
    const k = await key(env, "alice", ["tasks:read"]);
    const next = await manageApiKeys(env, "alice", {
      action: "rotate",
      id: k.metadata.id,
    });
    await assert.rejects(
      authenticateApi(request(k.key, "tasks"), env),
      /unauthenticated/,
    );
    assert.equal(
      (await authenticateApi(request(next.key, "tasks"), env)).scopes.has(
        "tasks:read",
      ),
      true,
    );
    await assert.rejects(key(env, "alice", ["account:write"]), /invalid-input/);
    await assert.rejects(
      manageApiKeys(env, "alice", {
        action: "create",
        name: "expired",
        scopes: ["tasks:read"],
        expiresAt: 1,
      }),
      /invalid-expiry/,
    );
    await env.DB.prepare("UPDATE user_api_keys SET expires_at=? WHERE id=?")
      .bind(Date.now() - 1, next.metadata.id)
      .run();
    await assert.rejects(
      authenticateApi(request(next.key, "tasks"), env),
      /unauthenticated/,
    );
  } finally {
    close();
  }
});
test("API executes existing planner, idempotency, CAS, duplicate checks, ownership and independent write scope", async () => {
  const { env, close } = setup();
  try {
    const repos = new Map();
    const handler = createApiHandler({
      assertAccount: async () => {},
      repository: (_, uid) => {
        if (!repos.has(uid)) repos.set(uid, new MemoryRepository(uid));
        return repos.get(uid);
      },
    });
    const a = await key(env, "alice", [
      "courses:write",
      "courses:read",
      "tasks:write",
      "tasks:read",
      "projects:write",
      "projects:read",
      "sections:write",
      "sections:read",
      "boards:read",
      "boards:write",
      "schedule:write",
      "schedule:read",
    ]);
    const b = await key(env, "bob", ["courses:read", "courses:write"]);
    const c = await key(env, "carol", ["courses:write"]);
    const call = async (k, path, method, body, id) => {
      const r = await handler(request(k, path, method, body, id), env);
      return { status: r.status, ...(await r.json()) };
    };
    const course = await call(a.key, "courses", "POST", {
      values: { name: "Synthetic course" },
    });
    assert.equal(course.status, 201);
    const id = course.result.id;
    const replay = await call(a.key, "courses", "POST", {
      values: { name: "Synthetic course" },
    });
    assert.equal(replay.result.id, id);
    assert.equal(replay.result.replayed, true);
    assert.equal(
      (await call(a.key, "courses", "POST", { values: { name: "Different" } }))
        .status,
      409,
    );
    const dup = await call(
      a.key,
      "courses",
      "POST",
      { values: { name: "Synthetic course" } },
      "synthetic-request-00002",
    );
    assert.equal(dup.result.id, id);
    assert.equal(dup.result.created, false);
    assert.equal((await call(b.key, "courses")).result.items.length, 0);
    assert.equal(
      (
        await call(
          b.key,
          "courses/" + id,
          "PATCH",
          { values: { name: "Stolen" }, expectedRevision: 0 },
          "synthetic-request-00003",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await call(
          a.key,
          "courses/" + id,
          "PATCH",
          { values: { name: "Updated" }, expectedRevision: 7 },
          "synthetic-request-00004",
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await call(
          a.key,
          "courses/" + id,
          "PATCH",
          { values: { name: "Updated" }, expectedRevision: 0 },
          "synthetic-request-00005",
        )
      ).status,
      200,
    );
    assert.equal((await call(c.key, "courses")).status, 403);
    const write = await call(c.key, "courses", "POST", {
      values: { name: "Write-only" },
    });
    assert.equal(write.status, 201);
    assert.deepEqual(Object.keys(write.result).sort(), [
      "created",
      "id",
      "revision",
    ]);
    const task = await call(
      a.key,
      "tasks",
      "POST",
      {
        values: {
          courseId: id,
          title: "Task",
          kind: "exam",
          due: "2026-12-01T12:00:00Z",
        },
      },
      "synthetic-request-00006",
    );
    assert.equal(task.status, 201);
    assert.equal(
      (
        await call(
          a.key,
          "tasks",
          "POST",
          { values: { courseId: "not-owned", title: "bad" } },
          "synthetic-request-00007",
        )
      ).status,
      422,
    );
    const project = await call(
      a.key,
      "projects",
      "POST",
      { values: { name: "Card", nextStep: "Read" } },
      "synthetic-request-00008",
    );
    assert.equal(project.status, 201, JSON.stringify(project));
    const board = await call(
      a.key,
      "boards/personal",
      "PUT",
      {
        expectedRevision: 0,
        state: {
          version: 1,
          items: [
            {
              id: "card1",
              kind: "card",
              projectId: project.result.id,
              x: 12,
              y: 32,
            },
          ],
          threads: [],
          circles: [],
        },
      },
      "synthetic-request-00009",
    );
    assert.equal(board.status, 201);
    assert.equal(
      (await call(a.key, "boards/personal")).result.state.items.length,
      1,
    );
    const lesson = await call(
      a.key,
      "schedule",
      "POST",
      { values: { courseId: id, day: 1, start: "10:00", end: "11:00" } },
      "synthetic-request-00010",
    );
    assert.equal(lesson.status, 201);
    assert.equal((await call(a.key, "courses?uid=bob")).status, 422);
    const audit = await env.DB.prepare("SELECT * FROM api_audit").all();
    assert.ok(!JSON.stringify(audit).includes("Synthetic course"));
    assert.ok(!JSON.stringify(audit).includes(a.key));
  } finally {
    close();
  }
});
test("account rate limit also bounds repeated dependency failures", async () => {
  const { env, close } = setup();
  try {
    const k = await key(env, "alice", ["courses:read"]);
    const h = createApiHandler({
      assertAccount: async () => {
        throw Object.assign(Error("unavailable"), { code: "ignored" });
      },
    });
    for (let i = 0; i < 60; i++)
      assert.equal((await h(request(k.key, "courses"), env)).status, 503);
    assert.equal((await h(request(k.key, "courses"), env)).status, 429);
  } finally {
    close();
  }
});
test("management requires browser identity and App Check boundary; external key cannot issue keys", async () => {
  const { env, close } = setup();
  try {
    const worker = createWorker({
      verifyIdentity: async () => {
        throw Error("unauthenticated");
      },
    });
    const k = await key(env, "alice", ["courses:write"]);
    const r = await worker.fetch(
      new Request("https://api.example/account-api-keys", {
        method: "POST",
        headers: {
          origin: "https://app.example",
          authorization: "Bearer " + k.key,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          name: "bad",
          scopes: ["courses:write"],
        }),
      }),
      env,
    );
    assert.equal(r.status, 401);
  } finally {
    close();
  }
});

test("each resource enforces its own read/write scope; reminders reuse existing settings and isolate owners", async () => {
  const { env, close } = setup();
  try {
    const repo = new MemoryRepository("alice");
    repo.seed("projects", "abcdefghijklmnopqrst", {
      name: "Synthetic card",
      status: "active",
      kind: "deadline",
      revision: 0,
    });
    const handler = createApiHandler({
      assertAccount: async () => {},
      repository: (_, uid) =>
        uid === "alice" ? repo : new MemoryRepository(uid),
    });
    const k = await key(env, "alice", ["reminders:read", "reminders:write"]);
    for (const resource of [
      "courses",
      "tasks",
      "schedule",
      "projects",
      "sections",
      "boards/personal",
    ])
      assert.equal((await handler(request(k.key, resource), env)).status, 403);
    const set = await handler(
      request(k.key, "reminders/abcdefghijklmnopqrst", "PUT", {
        disabled: false,
        weekly: true,
        time: "09:00",
      }),
      env,
    );
    assert.equal(set.status, 200);
    const get = await handler(
      request(k.key, "reminders/abcdefghijklmnopqrst"),
      env,
    );
    assert.equal(get.headers.get("cache-control"), "no-store");
    assert.equal((await get.json()).result.time, "09:00");
    const b = await key(env, "bob", ["reminders:read"]);
    assert.equal(
      (await handler(request(b.key, "reminders/abcdefghijklmnopqrst"), env))
        .status,
      404,
    );
    const readOnly = await key(env, "alice", ["courses:read"]);
    assert.equal(
      (
        await handler(
          request(readOnly.key, "courses", "POST", {
            values: { name: "Cannot create" },
          }),
          env,
        )
      ).status,
      403,
    );
  } finally {
    close();
  }
});
test("key limit, atomic rotation rollback, management no-store and API kill switch", async () => {
  const { env, close } = setup();
  try {
    let first;
    for (let i = 0; i < 10; i++) {
      const k = await key(env, "alice", ["courses:read"]);
      first ||= k;
    }
    await assert.rejects(key(env, "alice", ["courses:read"]), /key-limit/);
    const rotated = await manageApiKeys(env, "alice", {
      action: "rotate",
      id: first.metadata.id,
    });
    assert.ok(rotated.key);
    const other = await key(env, "bob", ["courses:read"]);
    // Failure of the audit INSERT rolls the whole issuance/rotation transaction back.
    env.DB.sqlite.exec(
      "CREATE TRIGGER reject_api_audit BEFORE INSERT ON api_audit BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END",
    );
    await assert.rejects(
      manageApiKeys(env, "bob", { action: "rotate", id: other.metadata.id }),
    );
    assert.equal(
      (await authenticateApi(request(other.key, "courses"), env)).uid,
      "bob",
    );
    env.DB.sqlite.exec("DROP TRIGGER reject_api_audit");
    const worker = createWorker({
      verifyIdentity: async () => ({ uid: "carol", emailVerified: true }),
      accountAvailable: async () => {},
    });
    const response = await worker.fetch(
      new Request("https://api.example/account-api-keys", {
        method: "POST",
        headers: {
          origin: "https://app.example",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "create",
          name: "Synthetic browser",
          scopes: ["courses:read"],
        }),
      }),
      env,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("pragma"), "no-cache");
    env.PUBLIC_API_ENABLED = "false";
    await assert.rejects(
      authenticateApi(request(rotated.key, "courses"), env),
      /api-disabled/,
    );
  } finally {
    close();
  }
});

test("suspended account and linked reminder edits fail without a write; stable imported links deduplicate", async () => {
  const { env, close } = setup();
  try {
    const repo = new MemoryRepository("alice"),
      k = await key(env, "alice", ["courses:write", "tasks:write"]);
    const blocked = createApiHandler({
      assertAccount: async () => {
        throw new ApiError("account-unavailable");
      },
      repository: () => repo,
    });
    assert.equal(
      (
        await blocked(
          request(k.key, "courses", "POST", { values: { name: "Blocked" } }),
          env,
        )
      ).status,
      403,
    );
    assert.equal(repo.docs.size, 0);
    const h = createApiHandler({
      assertAccount: async () => {},
      repository: () => repo,
    });
    const call = async (path, values, id) => {
      const response = await h(
        request(k.key, path, "POST", { values }, id),
        env,
      );
      assert.equal(response.status, 201, await response.clone().text());
      return (await response.json()).result;
    };
    const course = await call(
      "courses",
      { name: "Synthetic stable identity" },
      "stable-course-create-0001",
    );
    const task = await call(
      "tasks",
      {
        courseId: course.id,
        title: "Original imported title",
        url: "https://study.example/mod/assign/view.php?id=42",
      },
      "stable-task-create-000001",
    );
    const duplicate = await h(
      request(
        k.key,
        "tasks",
        "POST",
        {
          values: {
            courseId: course.id,
            title: "Different external title",
            url: "https://study.example/mod/assign/view.php?id=42",
          },
        },
        "stable-task-create-000002",
      ),
      env,
    );
    const result = (await duplicate.json()).result;
    assert.equal(result.id, task.id);
    assert.equal(result.created, false);
    const old = repo.get("studyRecords", "tasks_" + task.id),
      payload = JSON.parse(old.payload);
    payload.reminderProjectId = "abcdefghijklmnopqrst";
    repo.seed("studyRecords", "tasks_" + task.id, {
      ...old,
      payload: JSON.stringify(payload),
    });
    const edit = await h(
      request(
        k.key,
        "tasks/" + task.id,
        "PATCH",
        {
          expectedRevision: 0,
          values: { title: "Cannot bypass reminder workflow" },
        },
        "stable-task-update-00001",
      ),
      env,
    );
    assert.equal(edit.status, 409);
    assert.equal((await edit.json()).error, "linked-reminder-use-ui");
    assert.equal(
      JSON.parse(repo.get("studyRecords", "tasks_" + task.id).payload).title,
      "Original imported title",
    );
  } finally {
    close();
  }
});
