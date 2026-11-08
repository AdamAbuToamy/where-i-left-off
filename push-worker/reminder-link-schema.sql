-- Recovery hints for cross-store link completion; delivery uses the existing scopes/queue scheduler.
CREATE TABLE IF NOT EXISTS api_reminder_work (
 uid TEXT NOT NULL, task_id TEXT NOT NULL, created_at INTEGER NOT NULL, next_at INTEGER NOT NULL,
 PRIMARY KEY(uid,task_id), FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS api_reminder_work_due ON api_reminder_work(next_at);
