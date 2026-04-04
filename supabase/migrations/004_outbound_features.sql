-- F0199, F0205, F0207, F0208: Campaign retry configuration
CREATE TABLE IF NOT EXISTS voice_agent_campaign_retry_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id INTEGER UNIQUE NOT NULL REFERENCES voice_agent_campaigns(id) ON DELETE CASCADE,
  retry_delay_minutes INTEGER NOT NULL DEFAULT 60, -- F0205
  retry_on_busy BOOLEAN DEFAULT true, -- F0207
  retry_on_voicemail BOOLEAN DEFAULT true, -- F0208
  max_attempts INTEGER DEFAULT 3,
  voicemail_message TEXT, -- F0199: Custom voicemail drop text
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_retry_config_campaign ON voice_agent_campaign_retry_config(campaign_id);

ALTER TABLE voice_agent_campaign_retry_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all operations on retry_config" ON voice_agent_campaign_retry_config
  FOR ALL USING (true);

-- F0210: Campaign progress tracking - add stats fields to campaigns
ALTER TABLE voice_agent_campaigns
  ADD COLUMN IF NOT EXISTS total_contacts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dialed_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booked_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dnc_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;

-- F0213: Campaign conversion tracking
ALTER TABLE voice_agent_campaigns
  ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC(5,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS last_stats_updated_at TIMESTAMPTZ;

-- F0215: Campaign-specific caller ID
ALTER TABLE voice_agent_campaigns
  ADD COLUMN IF NOT EXISTS caller_id_number TEXT,
  ADD COLUMN IF NOT EXISTS caller_id_name TEXT;

-- F0220: Campaign report metadata
ALTER TABLE voice_agent_campaigns
  ADD COLUMN IF NOT EXISTS last_exported_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS export_count INTEGER DEFAULT 0;

-- F0224: Dynamic script branching - store script variations
CREATE TABLE IF NOT EXISTS voice_agent_script_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  condition_field TEXT NOT NULL, -- contact attribute to check (e.g., "company_size", "deal_stage")
  condition_operator TEXT NOT NULL, -- eq/ne/gt/lt/contains
  condition_value TEXT NOT NULL,
  script_override TEXT NOT NULL, -- Script to use if condition matches
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_script_branches_assistant ON voice_agent_script_branches(assistant_id);
CREATE INDEX idx_script_branches_condition_field ON voice_agent_script_branches(condition_field);

ALTER TABLE voice_agent_script_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all operations on script_branches" ON voice_agent_script_branches
  FOR ALL USING (true);

-- F0225: Outbound call rate limiting
CREATE TABLE IF NOT EXISTS voice_agent_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id INTEGER UNIQUE NOT NULL REFERENCES voice_agent_campaigns(id) ON DELETE CASCADE,
  max_calls_per_hour INTEGER NOT NULL DEFAULT 100,
  max_calls_per_day INTEGER NOT NULL DEFAULT 500,
  calls_this_hour INTEGER DEFAULT 0,
  calls_today INTEGER DEFAULT 0,
  hour_reset_at TIMESTAMPTZ,
  day_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rate_limits_campaign ON voice_agent_rate_limits(campaign_id);

ALTER TABLE voice_agent_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all operations on rate_limits" ON voice_agent_rate_limits
  FOR ALL USING (true);

-- F0228: Campaign scheduling
CREATE TABLE IF NOT EXISTS voice_agent_campaign_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id INTEGER UNIQUE NOT NULL REFERENCES voice_agent_campaigns(id) ON DELETE CASCADE,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/active/completed/cancelled
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_schedules_campaign ON voice_agent_campaign_schedules(campaign_id);
CREATE INDEX idx_campaign_schedules_status ON voice_agent_campaign_schedules(status);
CREATE INDEX idx_campaign_schedules_start ON voice_agent_campaign_schedules(scheduled_start) WHERE status = 'pending';

ALTER TABLE voice_agent_campaign_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all operations on campaign_schedules" ON voice_agent_campaign_schedules
  FOR ALL USING (true);

-- Also add convenience fields to campaigns table
ALTER TABLE voice_agent_campaigns
  ADD COLUMN IF NOT EXISTS scheduled_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_end_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_start BOOLEAN DEFAULT false;

-- F0235: Time-zone clustering support
ALTER TABLE voice_agent_contacts
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

CREATE INDEX IF NOT EXISTS idx_contacts_timezone ON voice_agent_contacts(timezone);

-- F0241: Outbound script storage
ALTER TABLE voice_agent_campaigns
  ADD COLUMN IF NOT EXISTS outbound_script TEXT,
  ADD COLUMN IF NOT EXISTS script_context JSONB;

-- F0244: Cold list validation - track bad numbers
CREATE TABLE IF NOT EXISTS voice_agent_invalid_numbers (
  phone TEXT PRIMARY KEY,
  reason TEXT NOT NULL, -- disconnected/invalid/spam/carrier-block
  detected_at TIMESTAMPTZ NOT NULL,
  validation_source TEXT, -- vapi/twilio/manual
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invalid_numbers_detected ON voice_agent_invalid_numbers(detected_at DESC);

ALTER TABLE voice_agent_invalid_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all operations on invalid_numbers" ON voice_agent_invalid_numbers
  FOR ALL USING (true);

-- F0246: Cost per call tracking
ALTER TABLE voice_agent_calls
  ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(10,4) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_calls_cost ON voice_agent_calls(cost_usd) WHERE cost_usd > 0;

-- F0230: Live campaign dashboard - create campaign activity log
CREATE TABLE IF NOT EXISTS voice_agent_campaign_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id INTEGER NOT NULL REFERENCES voice_agent_campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- started/paused/resumed/completed/call_placed/call_completed
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaign_activity_campaign ON voice_agent_campaign_activity(campaign_id);
CREATE INDEX idx_campaign_activity_timestamp ON voice_agent_campaign_activity(timestamp DESC);
CREATE INDEX idx_campaign_activity_event_type ON voice_agent_campaign_activity(event_type);

ALTER TABLE voice_agent_campaign_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all operations on campaign_activity" ON voice_agent_campaign_activity
  FOR ALL USING (true);

-- Comments
COMMENT ON TABLE voice_agent_campaign_retry_config IS 'F0199/F0205/F0207/F0208 - Campaign retry configuration';
COMMENT ON TABLE voice_agent_script_branches IS 'F0224 - Dynamic script branching based on contact attributes';
COMMENT ON TABLE voice_agent_rate_limits IS 'F0225 - Outbound call rate limiting per campaign';
COMMENT ON TABLE voice_agent_invalid_numbers IS 'F0244 - Invalid/bad number tracking for list validation';
COMMENT ON TABLE voice_agent_campaign_activity IS 'F0230 - Campaign activity log for live dashboard';
