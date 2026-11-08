CREATE TABLE IF NOT EXISTS reminder_dispatches (
 delivery_id TEXT PRIMARY KEY, uid TEXT NOT NULL, card_key TEXT NOT NULL, event_key TEXT NOT NULL,
 device_id TEXT NOT NULL, state TEXT NOT NULL, updated_at INTEGER NOT NULL,
 FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS reminder_dispatches_card ON reminder_dispatches(uid,card_key,event_key);
CREATE TABLE IF NOT EXISTS api_reminder_requests (
 uid TEXT NOT NULL,key_hash TEXT NOT NULL,fingerprint TEXT NOT NULL,project_id TEXT NOT NULL,
 response_version TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(uid,key_hash),
 FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
