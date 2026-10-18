-- F1410: Outbound disposition codes — call record columns
ALTER TABLE voice_agent_calls
  ADD COLUMN IF NOT EXISTS disposition_code TEXT,
  ADD COLUMN IF NOT EXISTS disposition_category TEXT,
  ADD COLUMN IF NOT EXISTS disposition_notes TEXT,
  ADD COLUMN IF NOT EXISTS disposition_set_by TEXT,
  ADD COLUMN IF NOT EXISTS disposition_set_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_disposition_code
  ON voice_agent_calls(disposition_code);
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_disposition_category
  ON voice_agent_calls(disposition_category);
