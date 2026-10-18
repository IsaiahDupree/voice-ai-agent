-- Sprint 6 (PRD §6 / UX-SPEC §3.5, §4.9) — SMB owner portal tokens.
--
-- Token-authenticated read-only portal at /owner/[token]. Replaces no-
-- one's password — the token IS the credential. Agencies issue them
-- per client; SMB owners can "forward to my team" which spawns a child
-- token under the same parent (revoking parent revokes the chain).
--
-- 30-day expiry by default; agency can rotate / revoke at any time.

CREATE TABLE IF NOT EXISTS owner_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE CASCADE,
  recipient_email TEXT,
  recipient_name TEXT,
  -- Free-text label so the agency knows who they sent it to ("owner",
  -- "office manager", "Sarah on the team").
  label TEXT,
  -- Forward chain. NULL = root token issued by agency. parent_id !=
  -- NULL = child token spawned by the SMB owner via "forward to my team".
  parent_id UUID REFERENCES owner_portal_tokens(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,
  -- Transcripts default off — flip per-token if the agency wants the
  -- SMB owner to see redacted transcripts of recent calls.
  allow_transcripts BOOLEAN NOT NULL DEFAULT FALSE,
  -- Use telemetry. Updated by the GET /api/owner/[token] handler.
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_owner_portal_tokens_token
  ON owner_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_owner_portal_tokens_tenant_active
  ON owner_portal_tokens(tenant_id, revoked_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_owner_portal_tokens_parent
  ON owner_portal_tokens(parent_id);

ALTER TABLE owner_portal_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role full access owner_portal_tokens"
  ON owner_portal_tokens;
CREATE POLICY "service role full access owner_portal_tokens"
  ON owner_portal_tokens FOR ALL USING (true);

COMMENT ON TABLE owner_portal_tokens IS 'Per-tenant SMB owner-portal tokens (Sprint 6). Token IS the credential.';
COMMENT ON COLUMN owner_portal_tokens.parent_id IS 'NULL for root tokens issued by the agency. Set when the SMB forwards to their team.';
COMMENT ON COLUMN owner_portal_tokens.allow_transcripts IS 'Off by default — HIPAA / privilege caution. Agency unlocks per token.';
