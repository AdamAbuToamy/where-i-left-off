import { ApiError } from "../../shared/universityApiPlan.mjs";
import { API_SCOPES } from "./apiKeys.mjs";
import { sha256 } from "../../shared/apiHash.mjs";
export { sha256, stableJson } from "../../shared/apiHash.mjs";
async function equalHash(a, b) {
  const bytes = (hex) =>
    Uint8Array.from(hex.match(/../g), (v) => parseInt(v, 16));
  const algorithm = { name: "HMAC", hash: "SHA-256" },
    message = new TextEncoder().encode("wilo-api-key:v1");
  const expected = await crypto.subtle.importKey(
    "raw",
    bytes(b),
    algorithm,
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", expected, message);
  const actual = await crypto.subtle.importKey(
    "raw",
    bytes(a),
    algorithm,
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", actual, signed, message);
}
export async function authenticateApi(request, env, now = Date.now()) {
  if (env.PUBLIC_API_ENABLED !== "true") throw new ApiError("api-disabled");
  const match = (request.headers.get("authorization") || "").match(
    /^Bearer (wilo_api_([A-Za-z0-9_-]{12})\.[A-Za-z0-9_-]{43})$/i,
  );
  if (!match) throw new ApiError("unauthenticated");
  const row = await env.DB.prepare("SELECT * FROM user_api_keys WHERE id=?")
    .bind(match[2])
    .first();
  const expected =
    row && /^[a-f0-9]{64}$/.test(row.digest) ? row.digest : "0".repeat(64);
  if (
    !(await equalHash(await sha256(match[1]), expected)) ||
    !row ||
    row.revoked_at !== null ||
    (row.expires_at !== null && row.expires_at <= now) ||
    !/^[A-Za-z0-9_-]{1,128}$/.test(row.uid)
  )
    throw new ApiError("unauthenticated");
  let scopes;
  try {
    scopes = JSON.parse(row.scopes);
  } catch {
    throw new ApiError("unauthenticated");
  }
  if (!Array.isArray(scopes) || scopes.some((s) => !API_SCOPES.includes(s)))
    throw new ApiError("unauthenticated");
  return { uid: row.uid, keyId: row.id, scopes: new Set(scopes) };
}
export function requireScopes(identity, ...scopes) {
  if (scopes.some((s) => !identity.scopes.has(s)))
    throw new ApiError("insufficient-scope");
}
export async function allowApiRequest(env, uid, now = Date.now()) {
  const row = await env.DB.prepare(
    `INSERT INTO assistant_connection_limits(uid,bucket,window_start,requests) VALUES(?,?,?,1)
 ON CONFLICT(uid,bucket) DO UPDATE SET window_start=excluded.window_start,requests=CASE WHEN window_start=excluded.window_start THEN requests+1 ELSE 1 END
 WHERE window_start<>excluded.window_start OR requests<60 RETURNING requests`,
  )
    .bind(uid, "public-api", Math.floor(now / 60000) * 60000)
    .first();
  if (!row) throw new ApiError("rate-limited");
}
