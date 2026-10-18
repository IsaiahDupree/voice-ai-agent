-- Sprint 5.4 (PRD §6 / UX-SPEC §3.1) — magic-link login.
--
-- One row per outstanding magic-link. token is a 32-byte URL-safe
-- random string (generated at request time and emailed). Hash isn't
-- stored at v1.0 — the table is service-role-only and the link itself
-- is the credential. Tighten in v1.x if this surface widens.

CREATE TABLE IF NOT EXISTS login_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  -- The user_id we'll mint into the JWT once verified. For v1.0 this is
  -- just the email (lower-cased) since we don't have a full users table;
  -- agency_users.user_id rows reference it. Keeps the contract stable
  -- when we add a real users table in v1.x.
  user_id TEXT NOT NULL,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  -- Where to land after verification.
  next_url TEXT NOT NULL DEFAULT '/dashboard/agency',
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  -- Source IP + UA for abuse tracing.
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_tokens_token ON login_tokens(token);
CREATE INDEX IF NOT EXISTS idx_login_tokens_email_recent
  ON login_tokens(email, created_at DESC);

ALTER TABLE login_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role full access login_tokens" ON login_tokens;
CREATE POLICY "service role full access login_tokens" ON login_tokens FOR ALL USING (true);

COMMENT ON TABLE login_tokens IS 'Outstanding magic-link tokens (Sprint 5.4). Single-use, 15-minute TTL.';
COMMENT ON COLUMN login_tokens.user_id IS 'Stable identifier — lower-cased email at v1.0; FK to a real users table in v1.x.';
