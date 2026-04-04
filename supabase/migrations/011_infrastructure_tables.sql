-- Migration 011: Infrastructure Tables and Advanced Features
-- Implements Database P1 features: F1109, F1113, F1114, F1115, F1116, F1117, F1118, F1119
-- F1121, F1122, F1123, F1124, F1125, F1126, F1469, F1470, F1471, F1472, F1473, F1474

-- ============================================================================
-- F1109: FULL-TEXT SEARCH INDEX ON TRANSCRIPTS
-- ============================================================================

-- Add tsvector column for full-text search
ALTER TABLE voice_agent_transcripts
ADD COLUMN IF NOT EXISTS plain_text_tsv tsvector
GENERATED ALWAYS AS (to_tsvector('english', COALESCE(plain_text, ''))) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_voice_agent_transcripts_fts ON voice_agent_transcripts USING GIN (plain_text_tsv);

-- ============================================================================
-- F1113: USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_agent_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user', 'agent', 'viewer')),
  org_id UUID,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_users_email ON voice_agent_users(email);
CREATE INDEX idx_voice_agent_users_org_id ON voice_agent_users(org_id);
CREATE INDEX idx_voice_agent_users_role ON voice_agent_users(role);

-- ============================================================================
-- F1114: API KEYS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_agent_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT UNIQUE NOT NULL,
  key_prefix TEXT NOT NULL,
  name TEXT,
  user_id UUID REFERENCES voice_agent_users(id) ON DELETE CASCADE,
  org_id UUID,
  scopes TEXT[] DEFAULT ARRAY['read', 'write'],
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_api_keys_key_hash ON voice_agent_api_keys(key_hash);
CREATE INDEX idx_voice_agent_api_keys_user_id ON voice_agent_api_keys(user_id);
CREATE INDEX idx_voice_agent_api_keys_org_id ON voice_agent_api_keys(org_id);
CREATE INDEX idx_voice_agent_api_keys_is_active ON voice_agent_api_keys(is_active) WHERE is_active = true;

-- ============================================================================
-- F1115, F1473, F1474: TOOL INVOCATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_agent_tool_invocations (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT REFERENCES voice_agent_calls(call_id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL, -- F1473
  params JSONB,            -- F1474
  result JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'error')),
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_tool_invocations_call_id ON voice_agent_tool_invocations(call_id);
CREATE INDEX idx_voice_agent_tool_invocations_tool_name ON voice_agent_tool_invocations(tool_name);
CREATE INDEX idx_voice_agent_tool_invocations_status ON voice_agent_tool_invocations(status);
CREATE INDEX idx_voice_agent_tool_invocations_created_at ON voice_agent_tool_invocations(created_at DESC);

-- ============================================================================
-- F1116: SMS TEMPLATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_agent_sms_templates (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  category TEXT DEFAULT 'general',
  is_active BOOLEAN DEFAULT true,
  org_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_sms_templates_slug ON voice_agent_sms_templates(slug);
CREATE INDEX idx_voice_agent_sms_templates_org_id ON voice_agent_sms_templates(org_id);
CREATE INDEX idx_voice_agent_sms_templates_category ON voice_agent_sms_templates(category);

-- ============================================================================
-- F1117: REQUEST LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_agent_request_logs (
  id BIGSERIAL PRIMARY KEY,
  request_id UUID DEFAULT gen_random_uuid(),
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  query_params JSONB,
  headers JSONB,
  body JSONB,
  response_status INTEGER,
  response_body JSONB,
  duration_ms INTEGER,
  user_id UUID REFERENCES voice_agent_users(id),
  api_key_id UUID REFERENCES voice_agent_api_keys(id),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_request_logs_request_id ON voice_agent_request_logs(request_id);
CREATE INDEX idx_voice_agent_request_logs_user_id ON voice_agent_request_logs(user_id);
CREATE INDEX idx_voice_agent_request_logs_api_key_id ON voice_agent_request_logs(api_key_id);
CREATE INDEX idx_voice_agent_request_logs_path ON voice_agent_request_logs(path);
CREATE INDEX idx_voice_agent_request_logs_created_at ON voice_agent_request_logs(created_at DESC);
CREATE INDEX idx_voice_agent_request_logs_status ON voice_agent_request_logs(response_status);

-- ============================================================================
-- F1118, F1469, F1470, F1471, F1472: AUDIT LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_agent_audit_log (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL, -- F1469: e.g., 'call', 'contact', 'campaign'
  entity_id TEXT NOT NULL,   -- F1470: UUID or ID of entity
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'read')), -- F1471
  changed_by UUID REFERENCES voice_agent_users(id), -- F1472
  before_data JSONB,
  after_data JSONB,
  changes JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_audit_log_entity ON voice_agent_audit_log(entity_type, entity_id);
CREATE INDEX idx_voice_agent_audit_log_action ON voice_agent_audit_log(action);
CREATE INDEX idx_voice_agent_audit_log_changed_by ON voice_agent_audit_log(changed_by);
CREATE INDEX idx_voice_agent_audit_log_created_at ON voice_agent_audit_log(created_at DESC);

-- ============================================================================
-- F1119: ERROR LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS voice_agent_error_logs (
  id BIGSERIAL PRIMARY KEY,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  request_id UUID,
  user_id UUID REFERENCES voice_agent_users(id),
  call_id TEXT REFERENCES voice_agent_calls(call_id),
  context JSONB DEFAULT '{}'::jsonb,
  severity TEXT DEFAULT 'error' CHECK (severity IN ('warning', 'error', 'critical')),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES voice_agent_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_error_logs_error_type ON voice_agent_error_logs(error_type);
CREATE INDEX idx_voice_agent_error_logs_call_id ON voice_agent_error_logs(call_id);
CREATE INDEX idx_voice_agent_error_logs_severity ON voice_agent_error_logs(severity);
CREATE INDEX idx_voice_agent_error_logs_resolved ON voice_agent_error_logs(resolved) WHERE NOT resolved;
CREATE INDEX idx_voice_agent_error_logs_created_at ON voice_agent_error_logs(created_at DESC);

-- ============================================================================
-- F1121: RLS POLICIES ON NEW TABLES
-- ============================================================================

-- Users
ALTER TABLE voice_agent_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_agent_users_service_role_policy" ON voice_agent_users
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "voice_agent_users_org_policy" ON voice_agent_users
  FOR ALL TO authenticated
  USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

-- API Keys
ALTER TABLE voice_agent_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_agent_api_keys_service_role_policy" ON voice_agent_api_keys
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "voice_agent_api_keys_org_policy" ON voice_agent_api_keys
  FOR ALL TO authenticated
  USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

-- Tool Invocations
ALTER TABLE voice_agent_tool_invocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_agent_tool_invocations_service_role_policy" ON voice_agent_tool_invocations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- SMS Templates
ALTER TABLE voice_agent_sms_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_agent_sms_templates_service_role_policy" ON voice_agent_sms_templates
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "voice_agent_sms_templates_org_policy" ON voice_agent_sms_templates
  FOR ALL TO authenticated
  USING (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (org_id IS NULL OR org_id = current_setting('app.current_org_id', true)::uuid);

-- Request Logs (admin only read)
ALTER TABLE voice_agent_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_agent_request_logs_service_role_policy" ON voice_agent_request_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Audit Log (admin only read)
ALTER TABLE voice_agent_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_agent_audit_log_service_role_policy" ON voice_agent_audit_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Error Logs (admin only)
ALTER TABLE voice_agent_error_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_agent_error_logs_service_role_policy" ON voice_agent_error_logs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================================
-- F1122: ADDITIONAL INDEXES (already covered above in table creation)
-- ============================================================================

-- Already created indexes on all FK and filter columns above

-- ============================================================================
-- F1123: SUPABASE REALTIME ON CALLS
-- ============================================================================

-- Enable realtime on voice_agent_calls for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE voice_agent_calls;

-- ============================================================================
-- F1124: UPDATED_AT TRIGGER FOR ALL TABLES
-- ============================================================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at column
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'voice_agent_calls',
    'voice_agent_contacts',
    'voice_agent_campaigns',
    'voice_agent_campaign_contacts',
    'voice_agent_users',
    'voice_agent_api_keys',
    'voice_agent_sms_templates',
    'voice_agent_bookings'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS update_%I_updated_at ON %I;
      CREATE TRIGGER update_%I_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- F1125: SUPABASE STORAGE BUCKET FOR CALL RECORDINGS
-- ============================================================================

-- Create storage bucket (this is typically done via Supabase CLI or Dashboard)
-- Documenting SQL for reference:

/*
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-recordings',
  'call-recordings',
  false,
  104857600, -- 100MB limit
  ARRAY['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm']
)
ON CONFLICT (id) DO NOTHING;
*/

-- Note: Storage bucket creation requires Supabase Dashboard or CLI
-- The above SQL is for documentation only

-- ============================================================================
-- F1126: CASCADE DELETES (already configured in table definitions above)
-- ============================================================================

-- All foreign keys created above use ON DELETE CASCADE where appropriate

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE voice_agent_users IS 'F1113: User accounts with org scoping';
COMMENT ON TABLE voice_agent_api_keys IS 'F1114: API key authentication tokens';
COMMENT ON TABLE voice_agent_tool_invocations IS 'F1115: Log of all tool/function calls during calls';
COMMENT ON TABLE voice_agent_sms_templates IS 'F1116: Reusable SMS templates with variable substitution';
COMMENT ON TABLE voice_agent_request_logs IS 'F1117: Audit log of all API requests';
COMMENT ON TABLE voice_agent_audit_log IS 'F1118: Audit log of all write operations';
COMMENT ON TABLE voice_agent_error_logs IS 'F1119: Error tracking for 500 errors and exceptions';

COMMENT ON COLUMN voice_agent_transcripts.plain_text_tsv IS 'F1109: Generated tsvector for full-text search';
COMMENT ON COLUMN voice_agent_tool_invocations.tool_name IS 'F1473: Name of tool invoked (e.g., bookAppointment)';
COMMENT ON COLUMN voice_agent_tool_invocations.params IS 'F1474: Tool input parameters';
COMMENT ON COLUMN voice_agent_audit_log.entity_type IS 'F1469: Type of entity (call, contact, campaign, etc)';
COMMENT ON COLUMN voice_agent_audit_log.entity_id IS 'F1470: ID of entity being audited';
COMMENT ON COLUMN voice_agent_audit_log.action IS 'F1471: Action performed (create, update, delete, read)';
COMMENT ON COLUMN voice_agent_audit_log.changed_by IS 'F1472: User who performed the action';
