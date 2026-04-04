-- F0145: Call abandonment detection - dedicated analytics table
CREATE TABLE IF NOT EXISTS voice_agent_call_abandonments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL REFERENCES voice_agent_calls(call_id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  ring_duration_seconds INTEGER NOT NULL,
  assistant_id TEXT,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_call_abandonments_call_id ON voice_agent_call_abandonments(call_id);
CREATE INDEX idx_call_abandonments_phone ON voice_agent_call_abandonments(phone_number);
CREATE INDEX idx_call_abandonments_assistant ON voice_agent_call_abandonments(assistant_id);
CREATE INDEX idx_call_abandonments_timestamp ON voice_agent_call_abandonments(timestamp DESC);

-- Add is_abandoned flag to calls table if not exists
ALTER TABLE voice_agent_calls
  ADD COLUMN IF NOT EXISTS is_abandoned BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_is_abandoned ON voice_agent_calls(is_abandoned) WHERE is_abandoned = true;

-- F0151: Max ringing duration config
CREATE TABLE IF NOT EXISTS voice_agent_ringing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id TEXT UNIQUE NOT NULL,
  max_ring_seconds INTEGER NOT NULL DEFAULT 30,
  voicemail_enabled BOOLEAN DEFAULT true,
  voicemail_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ringing_config_assistant ON voice_agent_ringing_config(assistant_id);

ALTER TABLE voice_agent_ringing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all operations on ringing_config" ON voice_agent_ringing_config
  FOR ALL USING (true);

-- Also add to assistants/campaigns tables for convenience
ALTER TABLE voice_agent_assistants
  ADD COLUMN IF NOT EXISTS max_ring_duration_seconds INTEGER DEFAULT 30;

ALTER TABLE voice_agent_campaigns
  ADD COLUMN IF NOT EXISTS max_ring_duration_seconds INTEGER DEFAULT 30;

-- F0169: Number health monitoring
CREATE TABLE IF NOT EXISTS voice_agent_number_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  last_checked_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT true,
  consecutive_failures INTEGER DEFAULT 0,
  last_failure_reason TEXT,
  call_count_24h INTEGER DEFAULT 0,
  abandonment_rate_24h NUMERIC(5,2) DEFAULT 0.00,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_number_health_phone ON voice_agent_number_health(phone_number);
CREATE INDEX idx_number_health_is_active ON voice_agent_number_health(is_active);
CREATE INDEX idx_number_health_last_checked ON voice_agent_number_health(last_checked_at DESC);

-- F0176: Missed call follow-up queue
CREATE TABLE IF NOT EXISTS voice_agent_missed_call_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL REFERENCES voice_agent_calls(call_id),
  original_caller TEXT NOT NULL,
  assistant_id TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/completed/failed/cancelled
  callback_call_id TEXT, -- ID of the callback call once executed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_missed_call_followups_scheduled ON voice_agent_missed_call_followups(scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_missed_call_followups_caller ON voice_agent_missed_call_followups(original_caller);
CREATE INDEX idx_missed_call_followups_status ON voice_agent_missed_call_followups(status);

-- Add RLS policies
ALTER TABLE voice_agent_call_abandonments ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_number_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_missed_call_followups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role all operations on abandonments" ON voice_agent_call_abandonments
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on number_health" ON voice_agent_number_health
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on missed_call_followups" ON voice_agent_missed_call_followups
  FOR ALL USING (true);

-- F0169: Alerts table for number health notifications
CREATE TABLE IF NOT EXISTS voice_agent_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL, -- info/warning/critical
  phone_number TEXT,
  message TEXT NOT NULL,
  details JSONB,
  acknowledged BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_alert_type ON voice_agent_alerts(alert_type);
CREATE INDEX idx_alerts_severity ON voice_agent_alerts(severity);
CREATE INDEX idx_alerts_acknowledged ON voice_agent_alerts(acknowledged) WHERE acknowledged = false;
CREATE INDEX idx_alerts_created ON voice_agent_alerts(created_at DESC);

ALTER TABLE voice_agent_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow service role all operations on alerts" ON voice_agent_alerts
  FOR ALL USING (true);

-- Comments
COMMENT ON TABLE voice_agent_call_abandonments IS 'F0145 - Tracks abandoned calls for analytics';
COMMENT ON TABLE voice_agent_ringing_config IS 'F0151 - Max ringing duration configuration per assistant';
COMMENT ON TABLE voice_agent_number_health IS 'F0169 - Monitors inbound number health metrics';
COMMENT ON TABLE voice_agent_missed_call_followups IS 'F0176 - Queue for missed call auto-callbacks';
COMMENT ON TABLE voice_agent_alerts IS 'F0169 - Health and system alerts';
