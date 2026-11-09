import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
/** Read-only deployment smoke gate. No login, account content or real Push. */
export async function verifyRuntimeHealth({
  fetcher = fetch,
  site = "https://where-i-left-off.web.app",
  worker = "https://wilo-free-push.adam2002hosny.workers.dev",
} = {}) {
  async function get(url, status = 200) {
    const r = await fetcher(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    assert.equal(
      r.status,
      status,
      `Unexpected status for ${new URL(url).pathname}`,
    );
    return r;
  }
  const live = await (await get(worker + "/healthz")).json();
  assert.equal(live.status, "live");
  const ready = await (await get(worker + "/readyz")).json();
  assert.equal(ready.status, "ready");
  assert.equal(ready.checks.storage, "ready");
  assert.equal(ready.checks.queue, "configured");
  const html = await (await get(site + "/index.html")).text(),
    asset = html.match(/src="(\/assets\/[A-Za-z0-9_.-]+\.js)"/);
  assert.ok(asset, "Hosting entry script not found");
  const entryResponse = await get(site + asset[1]);
  assert.match(
    entryResponse.headers.get("content-type") || "",
    /(?:java|ecma)script/i,
    "Hosting entry was replaced by a fallback page",
  );
  const script = await entryResponse.text();
  assert.ok(script.length > 100, "Hosting entry script is empty");
  const contract = await (await get(site + "/openapi-public-api.json")).json();
  assert.ok(contract.paths["/projects"]?.get);
  const denial = await get(worker + "/api/v1/projects", 401);
  assert.equal(denial.headers.get("x-wilo-api-version"), contract.info.version);
  assert.ok((await denial.json()).requestId);
  return {
    checkedAt: new Date().toISOString(),
    hosting: "available",
    worker: "live",
    storage: "ready",
    queue: "configured",
    apiVersion: contract.info.version,
    authenticationDenial: 401,
    productionWrites: false,
    phoneDelivery: "not-tested",
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    console.log(JSON.stringify(await verifyRuntimeHealth(), null, 2));
  } catch {
    console.error(
      "Runtime smoke check failed. Inspect readiness, Hosting assets and UI/Worker version compatibility; no automatic rollback was performed.",
    );
    process.exitCode = 1;
  }
}
