-- Apply each ALTER only if its column is absent (inspect PRAGMA table_info first).
ALTER TABLE user_api_keys ADD COLUMN quiet_hours_override INTEGER NOT NULL DEFAULT 0 CHECK(quiet_hours_override IN(0,1));
ALTER TABLE api_task_notifications ADD COLUMN bypass_quiet_hours INTEGER NOT NULL DEFAULT 0 CHECK(bypass_quiet_hours IN(0,1));
ALTER TABLE api_task_notifications ADD COLUMN requesting_key_id TEXT NOT NULL DEFAULT '';
