-- Assistant Interruption Config table
-- Stores per-assistant interruption sensitivity settings for semantic VAD
CREATE TABLE IF NOT EXISTS voice_agent_interruption_config (
  id BIGSERIAL PRIMARY KEY,
  assistant_id TEXT UNIQUE NOT NULL,
  sensitivity TEXT DEFAULT 'medium' CHECK (sensitivity IN ('low', 'medium', 'high')),
  enabled BOOLEAN DEFAULT TRUE,
  confidence_threshold DECIMAL(3, 2) DEFAULT 0.70 CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_interruption_config_assistant_id ON voice_agent_interruption_config(assistant_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_interruption_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER interruption_config_updated_at
  BEFORE UPDATE ON voice_agent_interruption_config
  FOR EACH ROW
  EXECUTE FUNCTION update_interruption_config_updated_at();

-- Comments
COMMENT ON TABLE voice_agent_interruption_config IS 'Stores per-assistant interruption detection sensitivity settings';
COMMENT ON COLUMN voice_agent_interruption_config.sensitivity IS 'Interruption sensitivity: low (strict), medium (balanced), high (responsive)';
COMMENT ON COLUMN voice_agent_interruption_config.confidence_threshold IS 'Minimum confidence threshold for triggering interruption pause';
