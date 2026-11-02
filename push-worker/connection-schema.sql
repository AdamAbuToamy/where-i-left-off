-- Account-owned credentials; no plaintext provider keys are persisted.
CREATE TABLE IF NOT EXISTS assistant_connections (
 uid TEXT PRIMARY KEY,
 ciphertext TEXT NOT NULL,
 lease_until INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY(uid) REFERENCES accounts(uid) ON DELETE CASCADE
);
