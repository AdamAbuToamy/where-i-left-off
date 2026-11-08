PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS accounts(uid TEXT PRIMARY KEY,prefs TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,enabled_at INTEGER NOT NULL DEFAULT 0,last_stale_date TEXT NOT NULL DEFAULT '',last_sync INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,uid TEXT NOT NULL,subscription TEXT NOT NULL,last_test INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS devices_uid ON devices(uid);
CREATE TABLE IF NOT EXISTS cards(uid TEXT NOT NULL,id TEXT NOT NULL,settings TEXT NOT NULL,PRIMARY KEY(uid,id),FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS events(uid TEXT NOT NULL,id TEXT NOT NULL,type TEXT NOT NULL,event_key TEXT NOT NULL,PRIMARY KEY(uid,id,type),FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS scopes(uid TEXT NOT NULL,scope TEXT NOT NULL,next_at INTEGER NOT NULL,lease INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(uid,scope),FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS scopes_due ON scopes(next_at,lease);
CREATE TABLE IF NOT EXISTS deliveries(id TEXT PRIMARY KEY,uid TEXT NOT NULL,created_at INTEGER NOT NULL,FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE);

CREATE INDEX IF NOT EXISTS deliveries_created ON deliveries(created_at);

CREATE TABLE IF NOT EXISTS ai_budget(day TEXT PRIMARY KEY,used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS ai_usage(uid TEXT NOT NULL,day TEXT NOT NULL,used INTEGER NOT NULL DEFAULT 0,last_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(uid,day),FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE);

-- Account-owned credentials; no plaintext provider keys are persisted.
CREATE TABLE IF NOT EXISTS assistant_connections (
 uid TEXT PRIMARY KEY,
 ciphertext TEXT NOT NULL,
 lease_until INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
-- Three bounded rate buckets per account; erased with the account.
CREATE TABLE IF NOT EXISTS assistant_connection_limits (
 uid TEXT NOT NULL,
 bucket TEXT NOT NULL,
 window_start INTEGER NOT NULL,
 requests INTEGER NOT NULL,
 PRIMARY KEY(uid,bucket),
 FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);

-- Administrator notification center: opt-in account history, bounded to latest 100.
CREATE TABLE IF NOT EXISTS notification_centers(uid TEXT PRIMARY KEY,last_read INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS notification_items(id TEXT NOT NULL,uid TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,url TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(uid,id),FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS notification_items_uid_time ON notification_items(uid,created_at DESC);

-- Generic account-owned task notifications, reusing the native Push queue.
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
