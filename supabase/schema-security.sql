-- Server-side administrator sessions; no public Data API access.
CREATE TABLE IF NOT EXISTS public.admin_sessions (token_hash TEXT PRIMARY KEY, expires_at BIGINT NOT NULL);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON public.admin_sessions(expires_at);
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_sessions FROM anon, authenticated;
CREATE INDEX IF NOT EXISTS attempts_account_started_idx ON public.attempts(account_id,started_at);
