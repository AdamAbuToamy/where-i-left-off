import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRuntimeHealth } from "./src/runtimeHealth.mjs";
import { createWorker } from "./src/index.mjs";
import { database } from "./test-db.mjs";
const req = (path = "/readyz", method = "GET") =>
  new Request("https://worker.test" + path, { method });
const fixture = () => ({
  DB: database(),
  PUSH_QUEUE: { async send() {}, async sendBatch() {} },
});
test("liveness is public/read-only; readiness verifies native and enabled API schema without account data", async () => {
  const env = fixture();
  try {
    const worker = createWorker({
      verifyIdentity: () => {
        throw Error("must-not-authenticate-operational-probe");
      },
    });
    assert.deepEqual(await (await worker.fetch(req("/healthz"), {})).json(), {
      status: "live",
    });
    const r = await worker.fetch(req(), env);
    assert.equal(r.status, 200);
    assert.match(r.headers.get("cache-control"), /no-store/);
    assert.deepEqual(await r.json(), {
      status: "ready",
      checks: { storage: "ready", queue: "configured" },
    });
    assert.equal(
      env.DB.sqlite.prepare("SELECT COUNT(*) AS n FROM accounts").get().n,
      0,
    );
    env.DB.sqlite.exec(
      readFileSync(new URL("api-schema.sql", import.meta.url), "utf8"),
    );
    assert.equal(
      (
        await createRuntimeHealth()(req(), {
          ...env,
          PUBLIC_API_ENABLED: "true",
        })
      ).status,
      200,
    );
  } finally {
    env.DB.sqlite.close();
  }
});
test("missing schema, database failure or absent queue fails readiness closed without secret diagnostics", async () => {
  const bad = {
    DB: {
      prepare() {
        throw Error("secret-canary-token");
      },
    },
    PUSH_QUEUE: { async send() {}, async sendBatch() {} },
  };
  const r = await createRuntimeHealth()(req(), bad);
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes("canary"));
  const env = fixture();
  try {
    assert.equal(
      (
        await createRuntimeHealth()(req(), {
          ...env,
          PUBLIC_API_ENABLED: "true",
        })
      ).status,
      503,
    );
    assert.equal(
      (await createRuntimeHealth()(req(), { ...env, PUSH_QUEUE: null })).status,
      503,
    );
  } finally {
    env.DB.sqlite.close();
  }
});
test("readiness coalesces probes and recovers when its bounded cache expires", async () => {
  const env = fixture();
  let now = 0,
    reads = 0,
    blocked = true;
  const prepare = env.DB.prepare;
  env.DB.prepare = (...args) => {
    reads++;
    if (blocked) throw Error("synthetic-storage-outage");
    return prepare(...args);
  };
  const health = createRuntimeHealth({ now: () => now, cacheMs: 50 });
  try {
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => health(req(), env)),
    );
    assert.equal(
      responses.every((r) => r.status === 503),
      true,
    );
    assert.equal(reads, 1);
    now = 51;
    blocked = false;
    assert.equal((await health(req(), env)).status, 200);
    assert.equal(reads, 2);
  } finally {
    env.DB.sqlite.close();
  }
});
test("a hung readiness probe has a response deadline; unsafe methods never query storage", async () => {
  let queries = 0;
  const env = {
    DB: {
      prepare() {
        queries++;
        return {
          bind() {
            return { first: () => new Promise(() => {}) };
          },
        };
      },
    },
    PUSH_QUEUE: { async send() {}, async sendBatch() {} },
  };
  const health = createRuntimeHealth({ timeoutMs: 5 });
  const r = await health(req(), env);
  assert.equal(r.status, 503);
  assert.equal(queries, 1);
  assert.equal((await health(req("/readyz", "POST"), env)).status, 405);
  assert.equal(queries, 1);
  assert.equal(await (await health(req("/healthz", "HEAD"), env)).text(), "");
});
