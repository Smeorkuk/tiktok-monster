CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS attempts_account_started_idx ON attempts(account_id,started_at);
