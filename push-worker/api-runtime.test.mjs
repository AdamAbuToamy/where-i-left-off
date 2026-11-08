import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
test("real workerd and D1 run key lifecycle and public API with no upstream network", async () => {
  const contents = `import {manageApiKeys} from './src/apiKeys.mjs';import {createApiHandler} from './src/apiEndpoint.mjs';import {MemoryRepository} from '../tests/helpers/apiMemoryRepository.mjs';const repos=new Map();const api=createApiHandler({assertAccount:async()=>{},repository:(_,uid)=>{if(!repos.has(uid))repos.set(uid,new MemoryRepository(uid));return repos.get(uid);}});export default {async fetch(request,env){if(new URL(request.url).pathname==='/synthetic-management')return Response.json(await manageApiKeys(env,'synthetic-user',await request.json()));return api(request,env);}};`;
  const { outputFiles } = await build({
    stdin: { contents, resolveDir: new URL(".", import.meta.url).pathname },
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
  });
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: outputFiles[0].text,
      compatibilityDate: "2026-10-20",
      d1Databases: { DB: "synthetic-api-db" },
      bindings: { PUBLIC_API_ENABLED: "true" },
      outboundService: () => {
        throw Error("Unexpected upstream");
      },
    }),
  );
  try {
    const db = await runtime.getD1Database("DB");
    const schema =
      readFileSync(new URL("./schema.sql", import.meta.url), "utf8") +
      readFileSync(new URL("./api-schema.sql", import.meta.url), "utf8");
    for (const sql of schema
      .replace(/--[^\n]*/g, "")
      .split(";")
      .filter((s) => s.trim()))
      await db.prepare(sql).run();
    const manage = async (body) => {
      const r = await runtime.dispatchFetch(
        "https://test.example/synthetic-management",
        { method: "POST", body: JSON.stringify(body) },
      );
      assert.equal(r.status, 200);
      return r.json();
    };
    const first = await manage({
      action: "create",
      name: "Synthetic runtime",
      scopes: ["courses:write", "courses:read"],
    });
    const call = (key) =>
      runtime.dispatchFetch("https://test.example/api/v1/courses", {
        method: "POST",
        headers: {
          authorization: "Bearer " + key,
          "content-type": "application/json",
          "idempotency-key": "runtime-idempotency-0001",
        },
        body: JSON.stringify({ values: { name: "Synthetic course" } }),
      });
    const created = await call(first.key);
    assert.equal(created.status, 201, await created.clone().text());
    const id = (await created.json()).result.id;
    const replay = await call(first.key);
    assert.equal((await replay.json()).result.id, id);
    const second = await manage({ action: "rotate", id: first.metadata.id });
    assert.equal((await call(first.key)).status, 401);
    assert.equal((await call(second.key)).status, 201);
    const list = await manage({ action: "list" });
    assert.ok(!JSON.stringify(list).includes(first.key));
    assert.ok(!JSON.stringify(list).includes(second.key));
    await manage({ action: "revoke", id: second.metadata.id });
    assert.equal((await call(second.key)).status, 401);
  } finally {
    await runtime.dispose();
  }
});
