import { test } from "node:test";
import assert from "node:assert/strict";
import { readBoundedJson } from "./src/httpSecurity.mjs";
import { allowConnectionRequest } from "./src/connectionRateLimit.mjs";
import { database } from "./test-db.mjs";
test("bounds streamed body bytes before buffering all untrusted input and cancels excess data", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode('{"text":"' + "ع".repeat(20)),
      );
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readBoundedJson(
      new Request("https://worker.test", {
        method: "POST",
        body,
        duplex: "half",
      }),
      20,
    ),
    /invalid-size/,
  );
  assert.equal(cancelled, true);
});
test("rejects oversized declared lengths, malformed UTF8, JSON primitives and arrays", async () => {
  for (const text of ["null", "[]", "true", '"text"', "{oops"])
    await assert.rejects(
      readBoundedJson(
        new Request("https://worker.test", { method: "POST", body: text }),
        100,
      ),
      /invalid-json/,
    );
  await assert.rejects(
    readBoundedJson(
      new Request("https://worker.test", {
        method: "POST",
        headers: { "content-length": "500" },
        body: "{}",
      }),
      10,
    ),
    /invalid-size/,
  );
  await assert.rejects(
    readBoundedJson(
      new Request("https://worker.test", {
        method: "POST",
        body: new Uint8Array([255]),
      }),
      10,
    ),
    /invalid-json/,
  );
  assert.deepEqual(
    await readBoundedJson(
      new Request("https://worker.test", {
        method: "POST",
        body: '{"action":"get"}',
      }),
      100,
    ),
    { action: "get" },
  );
});
test("account windows are atomic, reset after one minute and never share allowances across users or buckets", async () => {
  const env = { DB: database() };
  for (const uid of ["alice", "bob"])
    await env.DB.prepare("INSERT INTO accounts(uid,prefs) VALUES(?,?)")
      .bind(uid, "{}")
      .run();
  const results = await Promise.all(
    Array.from({ length: 16 }, () =>
      allowConnectionRequest(env, "alice", "connection-save", 1000),
    ),
  );
  assert.equal(results.filter(Boolean).length, 12);
  assert.equal(
    await allowConnectionRequest(env, "bob", "connection-save", 1000),
    true,
  );
  assert.equal(
    await allowConnectionRequest(env, "alice", "connection-status", 1000),
    true,
  );
  assert.equal(
    await allowConnectionRequest(env, "alice", "completion", 1000),
    true,
  );
  assert.equal(
    await allowConnectionRequest(env, "alice", "connection-save", 61000),
    true,
  );
  assert.equal(
    await allowConnectionRequest(env, "alice", "__proto__", 61000),
    false,
  );
  await env.DB.prepare("DELETE FROM accounts WHERE uid=?").bind("alice").run();
  assert.equal(
    (
      await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM assistant_connection_limits WHERE uid=?",
      )
        .bind("alice")
        .first()
    ).n,
    0,
  );
});
