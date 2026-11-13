CREATE TABLE accounts (
 id TEXT PRIMARY KEY,
 nickname TEXT NOT NULL,
 nickname_key TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 password_salt TEXT NOT NULL,
 recovery_hash TEXT NOT NULL,
 auth_version INTEGER NOT NULL DEFAULT 1,
 created_at BIGINT NOT NULL
);
CREATE TABLE player_sessions (
 token_hash TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 auth_version INTEGER NOT NULL,
 created_at BIGINT NOT NULL,
 expires_at BIGINT NOT NULL
);
CREATE INDEX player_sessions_account_idx ON player_sessions(account_id);
CREATE INDEX player_sessions_expiry_idx ON player_sessions(expires_at);
ALTER TABLE attempts ADD COLUMN account_id TEXT REFERENCES accounts(id);
ALTER TABLE attempts ADD COLUMN mode_id TEXT;
ALTER TABLE attempts ADD COLUMN board_key TEXT;
ALTER TABLE attempts ADD COLUMN public_consent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN deleted_at BIGINT;
CREATE INDEX attempts_ranking_idx ON attempts(board_key,account_id,percent) WHERE finished_at IS NOT NULL AND deleted_at IS NULL AND public_consent=1;
