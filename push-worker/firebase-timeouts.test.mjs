import { test } from "node:test";
import assert from "node:assert/strict";
import { readDocument, readCollection } from "./src/firebase.mjs";
const env = { FIREBASE_PROJECT_ID: "synthetic-project" },
  token = { auth: "synthetic-user-token" };
test("native Firestore read requests carry a bounded timeout and preserve decoded data", async (t) => {
  let signal;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    signal = options.signal;
    return Response.json({ fields: { name: { stringValue: "Synthetic" } } });
  });
  assert.deepEqual(
    await readDocument(env, "users/synthetic/projects/p", token),
    { name: "Synthetic" },
  );
  assert.ok(signal instanceof AbortSignal);
  assert.equal(signal.aborted, false);
});
test("the shared pagination deadline aborts a read without returning a partial snapshot", async (t) => {
  const total = new AbortController();
  t.mock.method(AbortSignal, "timeout", (ms) =>
    ms === 30000 ? total.signal : new AbortController().signal,
  );
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    total.abort(new DOMException("Synthetic timeout", "TimeoutError"));
    return Response.json({
      documents: [
        {
          name: "projects/p",
          fields: { name: { stringValue: "Partial data" } },
        },
      ],
      nextPageToken: "next",
    });
  });
  await assert.rejects(readCollection(env, "users/synthetic/projects", token), {
    name: "TimeoutError",
  });
  assert.equal(calls, 1);
});
