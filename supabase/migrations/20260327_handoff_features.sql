-- F0666: Handoff config table
-- F0672: Representative availability table
-- F0678: Transfer status tracking

-- Handoff configuration table
CREATE TABLE IF NOT EXISTS voice_agent_handoff_config (
  id BIGSERIAL PRIMARY KEY,
  assistant_id TEXT NOT NULL UNIQUE,
  triggers_enabled JSONB NOT NULL DEFAULT '{
    "high_value": true,
    "frustration": true,
    "compliance": true,
    "explicit_request": true,
    "dtmf_zero": true
  }'::jsonb,
  transfer_destination TEXT NOT NULL,
  hold_music_url TEXT,
  fallback_behavior TEXT NOT NULL DEFAULT 'callback' CHECK (fallback_behavior IN ('callback', 'voicemail', 'sms')),
  fallback_sms_template TEXT,
  recording_notice_enabled BOOLEAN NOT NULL DEFAULT true,
  recording_notice_message TEXT DEFAULT 'This call is being recorded for quality and training purposes.',
  resume_on_decline BOOLEAN NOT NULL DEFAULT true,
  log_transfer_reason BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- F0672: Representatives table for availability tracking
CREATE TABLE IF NOT EXISTS voice_agent_representatives (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  email TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  max_concurrent_calls INTEGER NOT NULL DEFAULT 3,
  current_calls INTEGER NOT NULL DEFAULT 0,
  last_status_change TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add sentiment column to calls table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_agent_calls' AND column_name = 'sentiment'
  ) THEN
    ALTER TABLE voice_agent_calls ADD COLUMN sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative'));
  END IF;
END $$;

-- Add agent_name column to calls table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_agent_calls' AND column_name = 'agent_name'
  ) THEN
    ALTER TABLE voice_agent_calls ADD COLUMN agent_name TEXT;
  END IF;
END $$;

-- F0678: Add transfer_status column to calls table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_agent_calls' AND column_name = 'transfer_status'
  ) THEN
    ALTER TABLE voice_agent_calls ADD COLUMN transfer_status TEXT CHECK (transfer_status IN ('transferring', 'transferred', 'transfer_failed', 'hold'));
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_handoff_config_assistant ON voice_agent_handoff_config(assistant_id);
CREATE INDEX IF NOT EXISTS idx_reps_availability ON voice_agent_representatives(is_available, current_calls);
CREATE INDEX IF NOT EXISTS idx_calls_sentiment ON voice_agent_calls(sentiment);
CREATE INDEX IF NOT EXISTS idx_calls_transfer_status ON voice_agent_calls(transfer_status);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_handoff_config_updated_at BEFORE UPDATE ON voice_agent_handoff_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_representatives_updated_at BEFORE UPDATE ON voice_agent_representatives
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
