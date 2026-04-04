-- F0253: Campaign RBAC - user roles table
CREATE TABLE IF NOT EXISTS voice_agent_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer', -- admin/operator/viewer
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON voice_agent_users(email);
CREATE INDEX idx_users_role ON voice_agent_users(role);

ALTER TABLE voice_agent_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all operations on users" ON voice_agent_users
  FOR ALL USING (true);

-- F0254: Campaign audit log - track all campaign state changes
CREATE TABLE IF NOT EXISTS voice_agent_campaign_audit_log (
  id BIGSERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES voice_agent_campaigns(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- created/started/paused/resumed/stopped/completed/config_updated/contact_added/contact_removed
  actor TEXT, -- User ID, email, or 'system'
  metadata JSONB, -- Additional context about the action
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_audit_log_campaign ON voice_agent_campaign_audit_log(campaign_id);
CREATE INDEX idx_campaign_audit_log_timestamp ON voice_agent_campaign_audit_log(timestamp DESC);
CREATE INDEX idx_campaign_audit_log_action ON voice_agent_campaign_audit_log(action);

ALTER TABLE voice_agent_campaign_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all operations on audit_log" ON voice_agent_campaign_audit_log
  FOR ALL USING (true);

-- F0258: Contact timezone override - allow manual timezone per contact
ALTER TABLE voice_agent_contacts
  ADD COLUMN IF NOT EXISTS timezone_override TEXT,
  ADD COLUMN IF NOT EXISTS timezone_source TEXT DEFAULT 'auto'; -- auto/manual/areacode

CREATE INDEX IF NOT EXISTS idx_contacts_timezone_override ON voice_agent_contacts(timezone_override) WHERE timezone_override IS NOT NULL;

-- F0259: Outbound callId storage - add call_id as alias/additional field
-- Note: last_call_id already exists, but we'll add next_attempt_at for retry scheduling
ALTER TABLE voice_agent_campaign_contacts
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voicemail_dropped BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS call_outcome TEXT; -- answered/voicemail/busy/no-answer/failed

CREATE INDEX IF NOT EXISTS idx_campaign_contacts_next_attempt ON voice_agent_campaign_contacts(next_attempt_at) WHERE next_attempt_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_outcome ON voice_agent_campaign_contacts(call_outcome);

-- F0261: Campaign cooldown - track last contact time globally across campaigns
ALTER TABLE voice_agent_contacts
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cooldown_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_last_contacted ON voice_agent_contacts(last_contacted_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_cooldown ON voice_agent_contacts(cooldown_until) WHERE cooldown_until IS NOT NULL;

-- Add campaign-level cooldown configuration
ALTER TABLE voice_agent_campaigns
  ADD COLUMN IF NOT EXISTS cooldown_hours INTEGER DEFAULT 24,
  ADD COLUMN IF NOT EXISTS respect_global_cooldown BOOLEAN DEFAULT true;

-- Comments
COMMENT ON TABLE voice_agent_users IS 'F0253 - User roles for RBAC (admin/operator/viewer)';
COMMENT ON TABLE voice_agent_campaign_audit_log IS 'F0254 - Audit log for all campaign state changes';
COMMENT ON COLUMN voice_agent_contacts.timezone_override IS 'F0258 - Manual timezone override (takes precedence over auto-detected)';
COMMENT ON COLUMN voice_agent_contacts.last_contacted_at IS 'F0261 - Last contact timestamp for global cooldown enforcement';
COMMENT ON COLUMN voice_agent_contacts.cooldown_until IS 'F0261 - Contact unavailable for calls until this timestamp';
COMMENT ON COLUMN voice_agent_campaign_contacts.next_attempt_at IS 'F0259/F0261 - Scheduled retry timestamp';
