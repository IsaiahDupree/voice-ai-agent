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

CREATE INDEX idx_round_robin_state_config_id ON round_robin_state(config_id);

-- Bookings table for round-robin tracking
CREATE TABLE IF NOT EXISTS bookings (
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

CREATE INDEX idx_bookings_booking_id ON bookings(booking_id);
CREATE INDEX idx_bookings_host_email ON bookings(host_email);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_round_robin_config_id ON bookings(round_robin_config_id);
CREATE INDEX idx_bookings_attendee_email ON bookings(attendee_email);

-- Update timestamp trigger for round_robin_state
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_round_robin_state_updated_at
  BEFORE UPDATE ON round_robin_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE round_robin_state IS 'Tracks current position in round-robin rotation per config';
COMMENT ON TABLE bookings IS 'Tracks all bookings including round-robin, collective, and recurring assignments';
COMMENT ON COLUMN bookings.booking_type IS 'Type: standard, round_robin, collective, or recurring';
COMMENT ON COLUMN bookings.metadata IS 'Additional booking metadata including collective attendees, recurrence info, etc.';
