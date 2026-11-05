import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { database } from "./test-db.mjs";
import { createWorker } from "./src/index.mjs";
import { accountAssistant, openConnection } from "./src/accountAssistant.mjs";
function fixture() {
  let uid = "alice",
    active = true;
  const sent = [];
  let status = 200;
  const env = {
    DB: database(),
    ASSISTANT_CONNECTION_KEY: randomBytes(32).toString("base64"),
    APP_ORIGINS: "https://app.test",
  };
  const worker = createWorker({
    verifyIdentity: async (r) => {
      if (r.headers.get("authorization") !== "Bearer valid")
        throw new Error("unauthenticated");
      return { uid, emailVerified: true };
    },
    accountAvailable: async () => {
      if (!active) throw new Error("account-unavailable");
    },
    assistantFetch: async (url, init) => {
      sent.push({ url, init });
      if (status !== 200)
        return new Response("private upstream body", { status });
      return new Response('data: {"choices":[]}\n\ndata: [DONE]\n\n', {
        headers: { "content-type": "text/event-stream" },
      });
    },
  });
  const call = (data, token = "valid", origin = "https://app.test") =>
    worker.fetch(
      new Request("https://worker.test/assistant-account", {
        method: "POST",
        headers: { origin, authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      }),
      env,
    );
  return {
    env,
    call,
    sent,
    providerStatus: (value) => {
      status = value;
    },
    actor: (value) => {
      uid = value;
    },
    block: () => {
      active = false;
    },
  };
}
const key = "sk_synthetic_account_key";
test("encrypted account connection survives new requests and is isolated across accounts", async () => {
  const f = fixture();
  assert.equal((await f.call({ action: "connection-save", key })).status, 200);
  const row = f.env.DB.sqlite
    .prepare("SELECT ciphertext FROM assistant_connections WHERE uid=?")
    .get("alice");
  assert.ok(!row.ciphertext.includes(key));
  assert.equal(await openConnection(f.env, "alice", row.ciphertext), key);
  await assert.rejects(openConnection(f.env, "bob", row.ciphertext));
  assert.deepEqual(
    await (await f.call({ action: "connection-status" })).json(),
    { result: { connected: true } },
  );
  f.actor("bob");
  assert.deepEqual(
    await (await f.call({ action: "connection-status", uid: "alice" })).json(),
    { result: { connected: false } },
  );
  assert.equal(
    (
      await f.call({
        action: "completion",
        input: { messages: [{ role: "user", content: "Hi" }] },
      })
    ).status,
    409,
  );
});
test("proxy streams using only the authenticated owner key and releases its request lease", async () => {
  const f = fixture();
  await f.call({ action: "connection-save", key });
  const response = await f.call({
    action: "completion",
    uid: "bob",
    input: {
      messages: [{ role: "user", content: "Hi" }],
      model: "malicious",
      max_tokens: 999999,
    },
  });
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes("[DONE]"));
  assert.equal(
    f.sent[0].url,
    "https://gen.pollinations.ai/v1/chat/completions",
  );
  assert.equal(f.sent[0].init.headers.Authorization, `Bearer ${key}`);
  const body = JSON.parse(f.sent[0].init.body);
  assert.equal(body.model, "deepseek/deepseek-v4.1-flash");
  assert.equal(body.max_tokens, 8192);
  assert.equal(
    f.env.DB.sqlite
      .prepare("SELECT lease_until FROM assistant_connections")
      .get().lease_until,
    0,
  );
});
test("disconnect deletes the binding; account erase cascades credentials", async () => {
  const f = fixture();
  await f.call({ action: "connection-save", key });
  await f.call({ action: "connection-delete" });
  assert.deepEqual(
    await (await f.call({ action: "connection-status" })).json(),
    { result: { connected: false } },
  );
  await f.call({ action: "connection-save", key });
  f.env.DB.sqlite.prepare("DELETE FROM accounts WHERE uid=?").run("alice");
  assert.equal(
    f.env.DB.sqlite
      .prepare("SELECT count(*) AS n FROM assistant_connections")
      .get().n,
    0,
  );
});
test("rejects unauthenticated, foreign-origin and disabled accounts before storing credentials", async () => {
  const f = fixture();
  assert.equal(
    (await f.call({ action: "connection-save", key }, "bad")).status,
    401,
  );
  assert.equal(
    (
      await f.call(
        { action: "connection-save", key },
        "valid",
        "https://evil.test",
      )
    ).status,
    403,
  );
  f.block();
  assert.equal((await f.call({ action: "connection-save", key })).status, 403);
  assert.equal(
    f.env.DB.sqlite
      .prepare("SELECT count(*) AS n FROM assistant_connections")
      .get().n,
    0,
  );
});

test("retains a binding through quota and transient failures; only a provider revocation removes it", async () => {
  const f = fixture();
  await f.call({ action: "connection-save", key });
  for (const status of [402, 429, 503]) {
    f.providerStatus(status);
    const r = await f.call({
      action: "completion",
      input: { messages: [{ role: "user", content: "Hi" }] },
    });
    assert.equal(r.status, status);
    assert.ok(!(await r.text()).includes("private upstream body"));
    assert.deepEqual(
      await (await f.call({ action: "connection-status" })).json(),
      { result: { connected: true } },
    );
  }
  f.providerStatus(401);
  assert.equal(
    (
      await f.call({
        action: "completion",
        input: { messages: [{ role: "user", content: "Hi" }] },
      })
    ).status,
    401,
  );
  assert.deepEqual(
    await (await f.call({ action: "connection-status" })).json(),
    { result: { connected: false } },
  );
});
test("rejects simultaneous generations for the same owner without contacting the provider", async () => {
  const f = fixture();
  await f.call({ action: "connection-save", key });
  f.env.DB.sqlite
    .prepare("UPDATE assistant_connections SET lease_until=?")
    .run(Date.now() + 60000);
  assert.equal(
    (
      await f.call({
        action: "completion",
        input: { messages: [{ role: "user", content: "Hi" }] },
      })
    ).status,
    429,
  );
  assert.equal(f.sent.length, 0);
});

for (const termination of ["client-abort", "deadline", "stream-cancel"]) {
  test(`a ${termination} releases a stalled generation so the next ordinary request is accepted`, async (t) => {
    const f = fixture();
    await f.call({ action: "connection-save", key });
    if (termination === "deadline")
      t.mock.timers.enable({ apis: ["setTimeout"] });
    const controller = new AbortController();
    const request = new Request("https://worker.test/assistant-account", {
      signal: controller.signal,
    });
    let cancelled = false;
    const response = await accountAssistant(
      request,
      f.env,
      "alice",
      {
        action: "completion",
        input: { messages: [{ role: "user", content: "Schedule tomorrow" }] },
      },
      {},
      async () =>
        new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
          { headers: { "content-type": "text/event-stream" } },
        ),
    );
    const pending = response.body.getReader();
    const read = pending.read();
    if (termination === "client-abort") controller.abort();
    else if (termination === "deadline") t.mock.timers.tick(20000);
    else await pending.cancel();
    await read;
    assert.equal(cancelled, true);
    assert.equal(
      f.env.DB.sqlite
        .prepare("SELECT lease_until FROM assistant_connections")
        .get().lease_until,
      0,
    );
    const next = await f.call({
      action: "completion",
      input: { messages: [{ role: "user", content: "Hi" }] },
    });
    assert.equal(next.status, 200);
    await next.text();
  });
}
