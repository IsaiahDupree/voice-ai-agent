-- F0292: Round-robin booking tables
-- F0293: Collective booking support

-- Round-robin state tracking
CREATE TABLE IF NOT EXISTS round_robin_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id TEXT NOT NULL UNIQUE,
  current_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_round_robin_state_config_id ON round_robin_state(config_id);

-- Bookings table for round-robin tracking
CREATE TABLE IF NOT EXISTS voice_agent_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL UNIQUE, -- Cal.com booking UID
  host_email TEXT NOT NULL,
  host_name TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  attendee_name TEXT NOT NULL,
  attendee_email TEXT NOT NULL,
  round_robin_config_id TEXT,
  booking_type TEXT DEFAULT 'standard', -- 'standard', 'round_robin', 'collective', 'recurring'
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure all expected columns exist on voice_agent_bookings (table may have been created earlier with fewer columns)
ALTER TABLE voice_agent_bookings ADD COLUMN IF NOT EXISTS host_email TEXT;
ALTER TABLE voice_agent_bookings ADD COLUMN IF NOT EXISTS host_name TEXT;
ALTER TABLE voice_agent_bookings ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE voice_agent_bookings ADD COLUMN IF NOT EXISTS attendee_name TEXT;
ALTER TABLE voice_agent_bookings ADD COLUMN IF NOT EXISTS attendee_email TEXT;
ALTER TABLE voice_agent_bookings ADD COLUMN IF NOT EXISTS round_robin_config_id TEXT;
ALTER TABLE voice_agent_bookings ADD COLUMN IF NOT EXISTS booking_type TEXT DEFAULT 'standard';
ALTER TABLE voice_agent_bookings ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_bookings_booking_id ON voice_agent_bookings(booking_id);
CREATE INDEX IF NOT EXISTS idx_bookings_host_email ON voice_agent_bookings(host_email);
CREATE INDEX IF NOT EXISTS idx_bookings_start_time ON voice_agent_bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_round_robin_config_id ON voice_agent_bookings(round_robin_config_id);
CREATE INDEX IF NOT EXISTS idx_bookings_attendee_email ON voice_agent_bookings(attendee_email);

-- Update timestamp trigger for round_robin_state
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_round_robin_state_updated_at ON round_robin_state;
CREATE TRIGGER update_round_robin_state_updated_at
  BEFORE UPDATE ON round_robin_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE round_robin_state IS 'Tracks current position in round-robin rotation per config';
COMMENT ON TABLE voice_agent_bookings IS 'Tracks all bookings including round-robin, collective, and recurring assignments';
COMMENT ON COLUMN voice_agent_bookings.booking_type IS 'Type: standard, round_robin, collective, or recurring';
COMMENT ON COLUMN voice_agent_bookings.metadata IS 'Additional booking metadata including collective attendees, recurrence info, etc.';
