-- Per-account credentials. Only SHA-256 digests are persisted; no recoverable secret value.
CREATE TABLE IF NOT EXISTS user_api_keys(
 id TEXT PRIMARY KEY, uid TEXT NOT NULL, name TEXT NOT NULL, digest TEXT NOT NULL,
 scopes TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER,
 revoked_at INTEGER, last_used_at INTEGER, quiet_hours_override INTEGER NOT NULL DEFAULT 0 CHECK(quiet_hours_override IN(0,1)),
 FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS user_api_keys_owner ON user_api_keys(uid,created_at);
CREATE TABLE IF NOT EXISTS api_audit(
 id TEXT PRIMARY KEY, uid TEXT NOT NULL, key_id TEXT NOT NULL, operation TEXT NOT NULL,
 status INTEGER NOT NULL, created_at INTEGER NOT NULL,
 FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS api_audit_owner_time ON api_audit(uid,created_at);
CREATE INDEX IF NOT EXISTS api_audit_time ON api_audit(created_at);
