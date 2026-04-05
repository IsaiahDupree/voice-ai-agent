-- Feature 215: Google Calendar OAuth tokens table
-- Stores access_token, refresh_token, and expiry for users who connect Google Calendar

CREATE TABLE IF NOT EXISTS google_calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, -- Can be NULL for single-user setups, or linked to auth.users if multi-user
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,

  -- OAuth tokens
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',

  -- Token expiry
  expires_at TIMESTAMPTZ NOT NULL, -- When the access_token expires

  -- User info from Google
  google_email TEXT,
  google_user_id TEXT,

  -- Calendar config
  calendar_id TEXT DEFAULT 'primary', -- Which calendar to use

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_refresh_at TIMESTAMPTZ, -- Last time token was refreshed

  -- Ensure one token per user/tenant combination
  UNIQUE(user_id, tenant_id)
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_tenant_id
  ON google_calendar_tokens(tenant_id);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_user_id
  ON google_calendar_tokens(user_id);

-- Index for google email lookups
CREATE INDEX IF NOT EXISTS idx_google_calendar_tokens_google_email
  ON google_calendar_tokens(google_email);

-- Auto-update updated_at timestamp
CREATE TRIGGER google_calendar_tokens_updated_at
  BEFORE UPDATE ON google_calendar_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE google_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own tokens
CREATE POLICY google_calendar_tokens_select_own ON google_calendar_tokens
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT id FROM tenants WHERE auth.uid() IS NOT NULL
    )
  );

-- Policy: Users can insert their own tokens
CREATE POLICY google_calendar_tokens_insert_own ON google_calendar_tokens
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT id FROM tenants WHERE auth.uid() IS NOT NULL
    )
  );

-- Policy: Users can update their own tokens
CREATE POLICY google_calendar_tokens_update_own ON google_calendar_tokens
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT id FROM tenants WHERE auth.uid() IS NOT NULL
    )
  );

-- Policy: Users can delete their own tokens
CREATE POLICY google_calendar_tokens_delete_own ON google_calendar_tokens
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT id FROM tenants WHERE auth.uid() IS NOT NULL
    )
  );

COMMENT ON TABLE google_calendar_tokens IS 'Feature 215: Stores Google Calendar OAuth tokens for scheduling integration';
COMMENT ON COLUMN google_calendar_tokens.access_token IS 'Short-lived access token (expires in ~1 hour)';
COMMENT ON COLUMN google_calendar_tokens.refresh_token IS 'Long-lived refresh token (used to obtain new access tokens)';
COMMENT ON COLUMN google_calendar_tokens.expires_at IS 'Timestamp when access_token expires';
COMMENT ON COLUMN google_calendar_tokens.calendar_id IS 'Google Calendar ID (default: "primary")';
