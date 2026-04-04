-- F0147: Add direction field (replaces source)
ALTER TABLE voice_agent_calls
  ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('inbound', 'outbound'));

-- F0146: Add constraint for call_id uniqueness (dedup protection)
-- Already exists as UNIQUE on call_id

-- Add inbound-specific fields used by webhook handler
ALTER TABLE voice_agent_calls
  ADD COLUMN IF NOT EXISTS contact_id BIGINT REFERENCES voice_agent_contacts(id),
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS personalized_greeting TEXT,
  ADD COLUMN IF NOT EXISTS is_emergency BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_voicemail BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_missed BOOLEAN DEFAULT FALSE;

-- F1400: Vapi call labels - for filtering and categorization
ALTER TABLE voice_agent_calls
  ADD COLUMN IF NOT EXISTS labels TEXT[];

-- F1401: Vapi call notes - for adding notes after call
ALTER TABLE voice_agent_calls
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index on direction for filtering
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_direction ON voice_agent_calls(direction);

-- Create index on contact_id for lookups
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_contact_id ON voice_agent_calls(contact_id);

-- F0125: Blocklist table for spam call filtering
CREATE TABLE IF NOT EXISTS voice_agent_blocklist (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_agent_blocklist_phone ON voice_agent_blocklist(phone);

-- F0135: Callbacks table for callback scheduling
CREATE TABLE IF NOT EXISTS voice_agent_callbacks (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  contact_name TEXT,
  notes TEXT,
  call_id TEXT REFERENCES voice_agent_calls(call_id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_agent_callbacks_scheduled_for ON voice_agent_callbacks(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_voice_agent_callbacks_status ON voice_agent_callbacks(status);
CREATE INDEX IF NOT EXISTS idx_voice_agent_callbacks_phone ON voice_agent_callbacks(phone);

-- Enable RLS on new tables
ALTER TABLE voice_agent_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_callbacks ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow service role all operations on blocklist" ON voice_agent_blocklist
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on callbacks" ON voice_agent_callbacks
  FOR ALL USING (true);

-- Migrate existing source field to direction if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_agent_calls' AND column_name = 'source'
  ) THEN
    UPDATE voice_agent_calls SET direction = source WHERE direction IS NULL;
    ALTER TABLE voice_agent_calls DROP COLUMN source;
  END IF;
END $$;
