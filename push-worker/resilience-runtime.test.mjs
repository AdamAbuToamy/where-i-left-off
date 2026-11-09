import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
test("real workerd/D1 overlapping native deliveries preserve one provider attempt per event and account isolation", async () => {
  const snapshot = Date.now(),
    instant = new Date(snapshot - 60000),
    fixtureDay = instant.toISOString().slice(0, 10),
    fixtureTime = instant.toISOString().slice(11, 16);
  const contents = `import{createWorker}from'./src/index.mjs';import{defaults,localParts}from'./policy.mjs';
 const id='p'.repeat(20),now=${snapshot},day='${fixtureDay}',time='${fixtureTime}';
 const worker=createWorker({accountAvailable:async()=>{},cardDocument:async(_env,uid)=>{if(!['alice','bob'].includes(uid))throw Error('card-unavailable');return{id,name:'Synthetic card',status:'active',dueDate:day};},sendPush:async(env,_subscription,payload)=>{await env.DB.prepare('INSERT INTO synthetic_effects(uid) VALUES(?)').bind(payload.uid).run();}});
 export default{async fetch(request,env){const uid=new URL(request.url).pathname.slice(1);let ack=false,retry=false;await worker.queue({messages:[{body:{type:'deliver',uid,scope:'',projectId:id,deviceId:uid+'-phone',event:{type:'due',key:'due:'+day+':'+time+':0',date:day},createdAt:now},ack(){ack=true;},retry(){retry=true;}}]},env);return Response.json({ack,retry});}};`;
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
      d1Databases: { DB: "synthetic-resilience-db" },
      outboundService: () => {
        throw Error("Unexpected upstream network");
      },
    }),
  );
  try {
    const db = await runtime.getD1Database("DB");
    for (const sql of readFileSync(
      new URL("schema.sql", import.meta.url),
      "utf8",
    )
      .replace(/--[^\n]*/g, "")
      .split(";")
      .filter((s) => s.trim()))
      await db.prepare(sql).run();
    await db.prepare("CREATE TABLE synthetic_effects(uid TEXT NOT NULL)").run();
    const now = snapshot,
      time = fixtureTime,
      prefs = {
        enabled: true,
        due: true,
        stale: false,
        staleDays: 14,
        defaultTime: time,
        leadMinutes: 0,
        quiet: false,
        quietStart: "22:00",
        quietEnd: "08:00",
        hideContent: true,
        timezone: "UTC",
        language: "en",
      };
    for (const uid of ["alice", "bob"]) {
      await db
        .prepare(
          "INSERT INTO accounts(uid,prefs,enabled,enabled_at) VALUES(?,?,1,?)",
        )
        .bind(uid, JSON.stringify(prefs), now - 86400000)
        .run();
      await db
        .prepare("INSERT INTO devices(id,uid,subscription) VALUES(?,?,?)")
        .bind(uid + "-phone", uid, "{}")
        .run();
    }
    const responses = await Promise.all(
      Array.from({ length: 40 }, (_, n) =>
        runtime.dispatchFetch(
          "https://synthetic.test/" + (n % 2 ? "alice" : "bob"),
        ),
      ),
    );
    for (const r of responses) {
      assert.equal(r.status, 200);
      assert.equal((await r.json()).retry, false);
    }
    const effects = (
      await db
        .prepare(
          "SELECT uid,COUNT(*) AS n FROM synthetic_effects GROUP BY uid ORDER BY uid",
        )
        .all()
    ).results;
    assert.deepEqual(effects, [
      { uid: "alice", n: 1 },
      { uid: "bob", n: 1 },
    ]);
    assert.equal(
      (
        await db
          .prepare(
            "SELECT COUNT(*) AS n FROM reminder_dispatches WHERE state='provider-accepted'",
          )
          .first()
      ).n,
      2,
    );
  } finally {
    await runtime.dispose();
  }
});

test("local Queue runtime retains exhausted synthetic jobs in the configured dead-letter route", async () => {
  const runtime = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      compatibilityDate: "2026-10-20",
      script: `export default {async queue(batch,env){for(const message of batch.messages){await env.DB.prepare('INSERT INTO synthetic_queue_attempts(kind) VALUES(?)').bind(batch.queue).run();if(batch.queue==='synthetic-source')message.retry({delaySeconds:0});else message.ack();}}};`,
      d1Databases: { DB: "synthetic-dlq-db" },
      queueProducers: { SOURCE: "synthetic-source" },
      queueConsumers: {
        "synthetic-source": {
          maxBatchSize: 1,
          maxBatchTimeout: 0,
          maxRetries: 2,
          retryDelay: 0,
          deadLetterQueue: "synthetic-failed",
        },
        "synthetic-failed": { maxBatchSize: 1, maxBatchTimeout: 0 },
      },
      outboundService: () => {
        throw Error("Unexpected upstream");
      },
    }),
  );
  try {
    const db = await runtime.getD1Database("DB");
    await db
      .prepare("CREATE TABLE synthetic_queue_attempts(kind TEXT NOT NULL)")
      .run();
    const queue = await runtime.getQueueProducer("SOURCE");
    await queue.send({ synthetic: true });
    const deadline = Date.now() + 10000;
    let rows = [];
    while (Date.now() < deadline) {
      rows = (
        await db
          .prepare(
            "SELECT kind,COUNT(*) AS n FROM synthetic_queue_attempts GROUP BY kind ORDER BY kind",
          )
          .all()
      ).results;
      if (rows.some((r) => r.kind === "synthetic-failed")) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.deepEqual(rows, [
      { kind: "synthetic-failed", n: 1 },
      { kind: "synthetic-source", n: 3 },
    ]);
  } finally {
    await runtime.dispose();
  }
});
