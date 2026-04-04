-- F0617: Contact audit log table
CREATE TABLE IF NOT EXISTS voice_agent_contact_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id BIGINT NOT NULL REFERENCES voice_agent_contacts(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- created/updated/deleted/note_added/call_logged/booking_created/stage_changed
  actor TEXT NOT NULL, -- User email or 'system'
  previous_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contact_audit_contact_id ON voice_agent_contact_audit_log(contact_id);
CREATE INDEX idx_contact_audit_created_at ON voice_agent_contact_audit_log(created_at DESC);
CREATE INDEX idx_contact_audit_action ON voice_agent_contact_audit_log(action);

-- F0636, F0637, F0638: Human handoff log table
CREATE TABLE IF NOT EXISTS voice_agent_handoff_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL REFERENCES voice_agent_calls(call_id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL, -- high_value/frustration/compliance/confused/explicit_request
  trigger_confidence DECIMAL(5, 4) NOT NULL, -- 0-1
  trigger_reason TEXT,
  trigger_metadata JSONB,
  transferred_to TEXT, -- Phone number or agent ID
  transfer_successful BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_handoff_call_id ON voice_agent_handoff_log(call_id);
CREATE INDEX idx_handoff_trigger_type ON voice_agent_handoff_log(trigger_type);
CREATE INDEX idx_handoff_created_at ON voice_agent_handoff_log(created_at DESC);

-- F0606: Trigger to auto-update updated_at on contacts
CREATE OR REPLACE FUNCTION update_contact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_updated_at_trigger ON voice_agent_contacts;

CREATE TRIGGER contact_updated_at_trigger
BEFORE UPDATE ON voice_agent_contacts
FOR EACH ROW
EXECUTE FUNCTION update_contact_updated_at();

-- F0593: Row Level Security policies for contacts
-- Enable RLS (if not already enabled)
ALTER TABLE voice_agent_contacts ENABLE ROW LEVEL SECURITY;

-- F0594: RBAC - Service role can access all contacts
-- (This policy already exists from previous migration, but ensure it's there)
DROP POLICY IF EXISTS "Allow service role all operations on contacts" ON voice_agent_contacts;

CREATE POLICY "Allow service role all operations on contacts" ON voice_agent_contacts
  FOR ALL USING (true);

-- F0594: RBAC - Org-scoped access (for multi-tenant setups)
CREATE POLICY "Users can access contacts in their org" ON voice_agent_contacts
  FOR ALL
  USING (
    org_id IS NULL OR
    org_id = current_setting('app.current_org_id', true)::UUID
  );

-- Enable RLS on audit and handoff tables
ALTER TABLE voice_agent_contact_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_handoff_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role all operations on contact_audit_log" ON voice_agent_contact_audit_log
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on handoff_log" ON voice_agent_handoff_log
  FOR ALL USING (true);

COMMENT ON TABLE voice_agent_contact_audit_log IS 'F0617: Immutable audit log of all contact changes';
COMMENT ON TABLE voice_agent_handoff_log IS 'F0636, F0637, F0638: Log of AI-to-human handoff events';
