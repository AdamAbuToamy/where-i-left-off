CREATE TABLE IF NOT EXISTS card_reminders (
 uid TEXT NOT NULL,card_key TEXT NOT NULL,id TEXT NOT NULL,schedule TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL DEFAULT 'active',
 created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,queued_at INTEGER NOT NULL DEFAULT 0,
 event_key TEXT NOT NULL DEFAULT '',scheduled_at INTEGER,device_ids TEXT NOT NULL DEFAULT '[]',
 started_at INTEGER,legacy_config TEXT NOT NULL DEFAULT '',PRIMARY KEY(uid,card_key,id),
 FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS card_reminder_operations (
 uid TEXT NOT NULL,key_hash TEXT NOT NULL,fingerprint TEXT NOT NULL,card_key TEXT NOT NULL,
 reminder_id TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(uid,key_hash),
 FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS card_reminders_owner ON card_reminders(uid,card_key,state);
