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
