PRAGMA foreign_keys=ON;

-- Administrator notification center: opt-in account history, bounded to latest 100.
CREATE TABLE IF NOT EXISTS notification_centers(uid TEXT PRIMARY KEY,last_read INTEGER NOT NULL DEFAULT 0,FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS notification_items(id TEXT NOT NULL,uid TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,url TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(uid,id),FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS notification_items_uid_time ON notification_items(uid,created_at DESC);
