CREATE TABLE IF NOT EXISTS api_task_notifications (
 uid TEXT NOT NULL, task_id TEXT NOT NULL, event_id TEXT NOT NULL, task_revision INTEGER NOT NULL,
 device_ids TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', reason TEXT NOT NULL DEFAULT '',
 created_at INTEGER NOT NULL, next_at INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0,
 queued_at INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(uid,task_id),
 FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS api_task_notifications_due ON api_task_notifications(state,next_at,lease_until);
CREATE TABLE IF NOT EXISTS api_task_notification_requests (
 uid TEXT NOT NULL, key_hash TEXT NOT NULL, fingerprint TEXT NOT NULL, task_id TEXT NOT NULL,
 PRIMARY KEY(uid,key_hash), FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS api_task_notification_deliveries (
 uid TEXT NOT NULL, task_id TEXT NOT NULL, device_id TEXT NOT NULL, state TEXT NOT NULL,
 started_at INTEGER NOT NULL, PRIMARY KEY(uid,task_id,device_id),
 FOREIGN KEY(uid,task_id) REFERENCES api_task_notifications(uid,task_id) ON DELETE CASCADE
);
