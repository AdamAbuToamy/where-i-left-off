import { securityHeaders } from "./httpSecurity.mjs";
const coreTables = [
  "accounts",
  "devices",
  "scopes",
  "cards",
  "reminder_dispatches",
  "card_reminders",
];
/** Operational readiness only: schema connectivity and binding presence, never account data or Push delivery. */
export function createRuntimeHealth({
  timeoutMs = 1500,
  cacheMs = 5000,
  now = Date.now,
} = {}) {
  const cache = new WeakMap();
  async function probe(env) {
    const queue =
      typeof env.PUSH_QUEUE?.send === "function" &&
      typeof env.PUSH_QUEUE?.sendBatch === "function";
    let timer;
    const storage = await Promise.race([
      Promise.resolve()
        .then(async () => {
          const tables =
            env.PUBLIC_API_ENABLED === "true"
              ? [...coreTables, "user_api_keys", "api_audit"]
              : coreTables;
          const result = await env.DB.prepare(
            `SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN (${tables.map(() => "?").join(",")})`,
          )
            .bind(...tables)
            .first();
          return result?.n === tables.length;
        })
        .catch(() => false),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
    return {
      status: storage && queue ? "ready" : "unavailable",
      checks: {
        storage: storage ? "ready" : "unavailable",
        queue: queue ? "configured" : "unavailable",
      },
    };
  }
  return async function health(request, env) {
    const path = new URL(request.url).pathname;
    if (!["/healthz", "/readyz"].includes(path)) return null;
    const headers = {
      ...securityHeaders,
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
    };
    if (!["GET", "HEAD"].includes(request.method))
      return new Response(JSON.stringify({ error: "method-not-allowed" }), {
        status: 405,
        headers: { ...headers, allow: "GET, HEAD" },
      });
    let value = { status: "live" };
    if (path === "/readyz") {
      let entry = cache.get(env);
      if (!entry || entry.expires <= now()) {
        entry = { expires: now() + cacheMs, promise: probe(env) };
        cache.set(env, entry);
      }
      value = await entry.promise;
    }
    return new Response(
      request.method === "HEAD" ? null : JSON.stringify(value),
      { status: value.status === "unavailable" ? 503 : 200, headers },
    );
  };
}
