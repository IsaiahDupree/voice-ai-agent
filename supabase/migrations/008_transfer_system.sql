-- F0656: Rep availability table
CREATE TABLE IF NOT EXISTS voice_agent_rep_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL, -- E.164 format
  email TEXT,
  skills JSONB, -- Array of skills (e.g., ['sales', 'support', 'technical'])
  available BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0, -- Lower = higher priority
  max_concurrent_calls INTEGER DEFAULT 3,
  current_calls INTEGER DEFAULT 0,
  timezone TEXT DEFAULT 'America/New_York',
  working_hours JSONB, -- {start: '09:00', end: '17:00', days: [1,2,3,4,5]}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rep_availability_available ON voice_agent_rep_availability(available, priority);
CREATE INDEX idx_rep_availability_rep_id ON voice_agent_rep_availability(rep_id);

-- F0650: Transfer outcomes table
CREATE TABLE IF NOT EXISTS voice_agent_transfer_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL REFERENCES voice_agent_calls(call_id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL DEFAULT false,
  transfer_type TEXT NOT NULL, -- warm/cold
  transfer_reason TEXT NOT NULL, -- F0662: Classified reason
  transferred_to TEXT, -- Phone number or rep ID
  rep_connected BOOLEAN DEFAULT false,
  rep_answered_in_seconds INTEGER, -- Time until rep answered
  outcome TEXT NOT NULL, -- completed/voicemail/timeout/failed/declined
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transfer_outcomes_call_id ON voice_agent_transfer_outcomes(call_id);
CREATE INDEX idx_transfer_outcomes_outcome ON voice_agent_transfer_outcomes(outcome);
CREATE INDEX idx_transfer_outcomes_created_at ON voice_agent_transfer_outcomes(created_at DESC);

-- F0642, F0643, F0647, F0648: Transfer configuration table
CREATE TABLE IF NOT EXISTS voice_agent_transfer_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistant_id TEXT UNIQUE, -- Null = default config
  warm_transfer_enabled BOOLEAN DEFAULT true, -- F0642
  cold_transfer_enabled BOOLEAN DEFAULT true, -- F0643
  timeout_seconds INTEGER DEFAULT 30, -- F0648
  hold_music_url TEXT, -- F0645
  voicemail_enabled BOOLEAN DEFAULT true, -- F0647
  voicemail_number TEXT,
  configured_phrases JSONB, -- F0639: Custom handoff phrases
  default_rep_id TEXT REFERENCES voice_agent_rep_availability(rep_id),
  fallback_number TEXT, -- F0672: When all reps offline
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transfer_config_assistant_id ON voice_agent_transfer_config(assistant_id);

-- F0673: Handoff context log (stores context packets sent to reps)
CREATE TABLE IF NOT EXISTS voice_agent_handoff_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL REFERENCES voice_agent_calls(call_id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES voice_agent_contacts(id),
  context_packet JSONB NOT NULL, -- Full context data
  rep_id TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_handoff_context_call_id ON voice_agent_handoff_context(call_id);
CREATE INDEX idx_handoff_context_rep_id ON voice_agent_handoff_context(rep_id);

-- Enable RLS
ALTER TABLE voice_agent_rep_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_transfer_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_transfer_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_handoff_context ENABLE ROW LEVEL SECURITY;

-- Service role policies
CREATE POLICY "Allow service role all operations on rep_availability" ON voice_agent_rep_availability
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on transfer_outcomes" ON voice_agent_transfer_outcomes
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on transfer_config" ON voice_agent_transfer_config
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on handoff_context" ON voice_agent_handoff_context
  FOR ALL USING (true);

-- F0661: Function to calculate transfer rate
CREATE OR REPLACE FUNCTION get_transfer_rate_stats(
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  total_calls BIGINT,
  transferred_calls BIGINT,
  transfer_rate DECIMAL,
  avg_time_to_answer DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH call_counts AS (
    SELECT COUNT(*) as total
    FROM voice_agent_calls
    WHERE
      (p_start_date IS NULL OR started_at >= p_start_date) AND
      (p_end_date IS NULL OR started_at <= p_end_date)
  ),
  transfer_stats AS (
    SELECT
      COUNT(*) as transferred,
      AVG(rep_answered_in_seconds) as avg_answer_time
    FROM voice_agent_transfer_outcomes
    WHERE
      (p_start_date IS NULL OR created_at >= p_start_date) AND
      (p_end_date IS NULL OR created_at <= p_end_date)
  )
  SELECT
    cc.total as total_calls,
    COALESCE(ts.transferred, 0) as transferred_calls,
    CASE
      WHEN cc.total > 0 THEN (COALESCE(ts.transferred, 0)::DECIMAL / cc.total * 100)
      ELSE 0
    END as transfer_rate,
    COALESCE(ts.avg_answer_time, 0) as avg_time_to_answer
  FROM call_counts cc, transfer_stats ts;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE voice_agent_rep_availability IS 'F0656: Human rep availability and routing';
COMMENT ON TABLE voice_agent_transfer_outcomes IS 'F0650: Transfer outcome tracking';
COMMENT ON TABLE voice_agent_transfer_config IS 'F0642, F0643, F0647, F0648: Transfer system configuration';
COMMENT ON TABLE voice_agent_handoff_context IS 'F0673: Handoff context packets sent to reps';
