-- DNC (Do Not Call) List table - F0193, F0194
CREATE TABLE IF NOT EXISTS voice_agent_dnc (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT 'manual', -- manual, self-service, import
  reason TEXT,
  added_by TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_voice_agent_dnc_phone ON voice_agent_dnc(phone);
CREATE INDEX idx_voice_agent_dnc_source ON voice_agent_dnc(source);
CREATE INDEX idx_voice_agent_dnc_added_at ON voice_agent_dnc(added_at DESC);

-- Blocklist table (if not exists - for spam call filtering)
CREATE TABLE IF NOT EXISTS voice_agent_blocklist (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  reason TEXT,
  blocked_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_voice_agent_blocklist_phone ON voice_agent_blocklist(phone);

-- Callbacks table (if not exists - for scheduled callbacks)
CREATE TABLE IF NOT EXISTS voice_agent_callbacks (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  contact_id BIGINT REFERENCES voice_agent_contacts(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, completed, failed, cancelled
  notes TEXT,
  call_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_agent_callbacks_phone ON voice_agent_callbacks(phone);
CREATE INDEX IF NOT EXISTS idx_voice_agent_callbacks_status ON voice_agent_callbacks(status);
CREATE INDEX IF NOT EXISTS idx_voice_agent_callbacks_scheduled_for ON voice_agent_callbacks(scheduled_for);

-- Cal.com bookings table - F0297
CREATE TABLE IF NOT EXISTS voice_agent_bookings (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT UNIQUE, -- Cal.com booking ID
  call_id TEXT REFERENCES voice_agent_calls(call_id) ON DELETE SET NULL,
  event_type_id TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  attendee_name TEXT NOT NULL,
  attendee_email TEXT NOT NULL,
  attendee_phone TEXT,
  status TEXT DEFAULT 'confirmed', -- confirmed, cancelled, rescheduled
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_bookings_call_id ON voice_agent_bookings(call_id);
CREATE INDEX idx_voice_agent_bookings_booking_id ON voice_agent_bookings(booking_id);
CREATE INDEX idx_voice_agent_bookings_start_time ON voice_agent_bookings(start_time);

-- Add missing fields to campaigns table for retry logic and voicemail - F0197-F0243
ALTER TABLE voice_agent_campaigns
  ADD COLUMN IF NOT EXISTS voicemail_detection BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS voicemail_drop_url TEXT,
  ADD COLUMN IF NOT EXISTS retry_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_max INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS retry_on_no_answer BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS retry_on_voicemail BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_exclusion_on_booked BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tcpa_compliance BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS first_message TEXT,
  ADD COLUMN IF NOT EXISTS script_variables JSONB;

-- Add outcome and enhanced tracking to campaign_contacts - F0212, F0239
ALTER TABLE voice_agent_campaign_contacts
  ADD COLUMN IF NOT EXISTS outcome TEXT, -- booked, no-answer, dnc, voicemail, failed
  ADD COLUMN IF NOT EXISTS booked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS local_time_check BOOLEAN DEFAULT false;

-- Add campaign_id and contact_id to calls table for linking - F0214
ALTER TABLE voice_agent_calls
  ADD COLUMN IF NOT EXISTS campaign_id BIGINT REFERENCES voice_agent_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_id BIGINT REFERENCES voice_agent_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_campaign_id ON voice_agent_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_contact_id ON voice_agent_calls(contact_id);

-- Enable RLS on new tables
ALTER TABLE voice_agent_dnc ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_blocklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_callbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_bookings ENABLE ROW LEVEL SECURITY;

-- Create policies for new tables
CREATE POLICY "Allow service role all operations on dnc" ON voice_agent_dnc
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on blocklist" ON voice_agent_blocklist
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on callbacks" ON voice_agent_callbacks
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on bookings" ON voice_agent_bookings
  FOR ALL USING (true);
