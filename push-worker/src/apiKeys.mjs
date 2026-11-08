import { sha256 } from "../../shared/apiHash.mjs";
import { ApiError } from "../../shared/universityApiPlan.mjs";
import { ensureAccount } from "./store.mjs";
import { defaults } from "../policy.mjs";
export const API_SCOPES = Object.freeze([
  "courses:read",
  "courses:write",
  "tasks:read",
  "tasks:write",
  "schedule:read",
  "schedule:write",
  "projects:read",
  "projects:write",
  "sections:read",
  "sections:write",
  "boards:read",
  "boards:write",
  "reminders:read",
  "reminders:write",
]);
export const API_SCOPE_LABELS = {
  courses: "Courses",
  tasks: "Assignments and exams",
  schedule: "Weekly classes",
  projects: "Cards and projects",
  sections: "Card sections",
  boards: "Personal planning board",
  reminders: "Card reminders",
};
function input(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new ApiError("invalid-input");
}
const publicRow = (row, now = Date.now()) => ({
  id: row.id,
  name: row.name,
  scopes: JSON.parse(row.scopes),
  quietHoursOverride: row.quiet_hours_override === 1,
  createdAt: row.created_at,
  expiresAt: row.expires_at,
  lastUsedAt: row.last_used_at,
  status: row.revoked_at
    ? "revoked"
    : row.expires_at !== null && row.expires_at <= now
      ? "expired"
      : "active",
});
export async function auditApi(env, uid, keyId, operation, status) {
  try {
    await env.DB.prepare(
      "INSERT INTO api_audit(id,uid,key_id,operation,status,created_at) VALUES(?,?,?,?,?,?)",
    )
      .bind(crypto.randomUUID(), uid, keyId, operation, status, Date.now())
      .run();
  } catch {
    throw new ApiError("audit-unavailable");
  }
}
export async function manageApiKeys(env, uid, data) {
  if (env.PUBLIC_API_ENABLED !== "true") throw new ApiError("api-disabled");
  input(data, [
    "action",
    "id",
    "name",
    "scopes",
    "expiresAt",
    "quietHoursOverride",
  ]);
  await ensureAccount(env, uid, defaults);
  const now = Date.now();
  const rate =
    data.action === "revoke"
      ? true
      : await env.DB.prepare(
          `INSERT INTO assistant_connection_limits(uid,bucket,window_start,requests) VALUES(?,?,?,1) ON CONFLICT(uid,bucket) DO UPDATE SET window_start=excluded.window_start,requests=CASE WHEN window_start=excluded.window_start THEN requests+1 ELSE 1 END WHERE window_start<>excluded.window_start OR requests<30 RETURNING requests`,
        )
          .bind(uid, "api-key-management", Math.floor(now / 60000) * 60000)
          .first();
  if (!rate) throw new ApiError("rate-limited");
  if (data.action === "list") {
    const rows = await env.DB.prepare(
      "SELECT id,name,scopes,created_at,expires_at,revoked_at,last_used_at,quiet_hours_override FROM user_api_keys WHERE uid=? AND revoked_at IS NULL ORDER BY (expires_at IS NULL OR expires_at > ?) DESC, created_at DESC LIMIT 100",
    )
      .bind(uid, now)
      .all();
    return {
      keys: rows.results.map((r) => publicRow(r, now)),
      availableScopes: API_SCOPES,
    };
  }
  if (!["create", "rotate", "revoke", "update"].includes(data.action))
    throw new ApiError("invalid-input");
  if (
    data.action !== "create" &&
    (typeof data.id !== "string" || !/^[A-Za-z0-9_-]{12}$/.test(data.id))
  )
    throw new ApiError("invalid-input");
  if (data.action === "update") {
    input(data, ["action", "id", "quietHoursOverride"]);
    if (typeof data.quietHoursOverride !== "boolean")
      throw new ApiError("invalid-input");
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE user_api_keys SET quiet_hours_override=? WHERE uid=? AND id=? AND revoked_at IS NULL",
      ).bind(data.quietHoursOverride ? 1 : 0, uid, data.id),
      env.DB.prepare(
        "INSERT INTO api_audit(id,uid,key_id,operation,status,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM user_api_keys WHERE uid=? AND id=?)",
      ).bind(
        crypto.randomUUID(),
        uid,
        data.id,
        data.quietHoursOverride
          ? "key.quiet-override.enable"
          : "key.quiet-override.disable",
        200,
        now,
        uid,
        data.id,
      ),
    ]);
    if (!results[0].meta.changes) throw new ApiError("key-not-found");
    return { ok: true };
  }
  if (data.action === "revoke") {
    const rows = await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO api_audit(id,uid,key_id,operation,status,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM user_api_keys WHERE uid=? AND id=?)",
      ).bind(
        crypto.randomUUID(),
        uid,
        data.id,
        "key.revoke",
        200,
        now,
        uid,
        data.id,
      ),
      env.DB.prepare("DELETE FROM user_api_keys WHERE uid=? AND id=?").bind(
        uid,
        data.id,
      ),
    ]);
    if (!rows[1].meta.changes) throw new ApiError("key-not-found");
    return { ok: true };
  }
  let quietHoursOverride = data.quietHoursOverride ?? false;
  if (typeof quietHoursOverride !== "boolean")
    throw new ApiError("invalid-input");
  let name = data.name,
    scopes = data.scopes,
    expiresAt = data.expiresAt ?? null;
  if (data.action === "rotate") {
    const old = await env.DB.prepare(
      "SELECT * FROM user_api_keys WHERE uid=? AND id=? AND revoked_at IS NULL",
    )
      .bind(uid, data.id)
      .first();
    if (!old) throw new ApiError("key-not-found");
    quietHoursOverride = old.quiet_hours_override === 1;
    name = old.name;
    scopes = JSON.parse(old.scopes);
    expiresAt = data.expiresAt === undefined ? old.expires_at : data.expiresAt;
  }
  if (
    typeof name !== "string" ||
    !name.trim() ||
    /[\u0000-\u001f\u007f]/.test(name) ||
    name.length > 60 ||
    !Array.isArray(scopes) ||
    !scopes.length ||
    scopes.length > API_SCOPES.length ||
    scopes.some((s) => !API_SCOPES.includes(s)) ||
    new Set(scopes).size !== scopes.length
  )
    throw new ApiError("invalid-input");
  if (
    expiresAt !== null &&
    (!Number.isSafeInteger(expiresAt) ||
      expiresAt <= now ||
      expiresAt > now + 366 * 86400000)
  )
    throw new ApiError("invalid-expiry");
  const bytes = (n) => {
    const b = crypto.getRandomValues(new Uint8Array(n));
    return btoa(String.fromCharCode(...b))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replaceAll("=", "");
  };
  const id = bytes(9),
    secret = "wilo_api_" + id + "." + bytes(32),
    digest = await sha256(secret),
    scopeJson = JSON.stringify(scopes);
  const insert = env.DB.prepare(
    `INSERT INTO user_api_keys(id,uid,name,digest,scopes,created_at,expires_at,quiet_hours_override)
 SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM user_api_keys WHERE uid=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>?) AND id<>?)<?
 ${data.action === "rotate" ? "AND EXISTS(SELECT 1 FROM user_api_keys WHERE uid=? AND id=? AND revoked_at IS NULL)" : ""}`,
  ).bind(
    id,
    uid,
    name.trim(),
    digest,
    scopeJson,
    now,
    expiresAt,
    quietHoursOverride ? 1 : 0,
    uid,
    now,
    data.action === "rotate" ? data.id : "",
    10,
    ...(data.action === "rotate" ? [uid, data.id] : []),
  );
  const statements = [insert];
  if (data.action === "rotate")
    statements.push(
      env.DB.prepare(
        "DELETE FROM user_api_keys WHERE uid=? AND id=? AND EXISTS(SELECT 1 FROM user_api_keys WHERE uid=? AND id=?)",
      ).bind(uid, data.id, uid, id),
    );
  statements.push(
    env.DB.prepare(
      "INSERT INTO api_audit(id,uid,key_id,operation,status,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM user_api_keys WHERE uid=? AND id=?)",
    ).bind(
      crypto.randomUUID(),
      uid,
      id,
      "key." + data.action,
      201,
      now,
      uid,
      id,
    ),
  );
  const rows = await env.DB.batch(statements);
  if (!rows[0].meta.changes) throw new ApiError("key-limit");

  return {
    key: secret,
    metadata: {
      id,
      name: name.trim(),
      scopes,
      quietHoursOverride,
      createdAt: now,
      expiresAt,
      lastUsedAt: null,
      status: "active",
    },
  };
}
