-- Explicit retention change: purge only credentials already revoked.
-- Active and expired-but-not-revoked keys are preserved. No secrets are selected or returned.
DELETE FROM user_api_keys WHERE revoked_at IS NOT NULL;
