const policies = {
  "connection-status": { bucket: "status", limit: 120 },
  "connection-save": { bucket: "binding", limit: 12 },
  "connection-delete": { bucket: "binding", limit: 12 },
  completion: { bucket: "generation", limit: 30 },
};
/** Atomic, account-scoped fixed window. Never count model content or credentials. */
export async function allowConnectionRequest(
  env,
  uid,
  action,
  now = Date.now(),
) {
  const policy = Object.hasOwn(policies, action) ? policies[action] : undefined;
  if (!policy) return false;
  const window = Math.floor(now / 60000) * 60000;
  const row = await env.DB.prepare(
    `INSERT INTO assistant_connection_limits(uid,bucket,window_start,requests) VALUES(?,?,?,1)
 ON CONFLICT(uid,bucket) DO UPDATE SET window_start=excluded.window_start,requests=CASE WHEN window_start=excluded.window_start THEN requests+1 ELSE 1 END
 WHERE window_start<>excluded.window_start OR requests<? RETURNING requests`,
  )
    .bind(uid, policy.bucket, window, policy.limit)
    .first();
  return !!row;
}
