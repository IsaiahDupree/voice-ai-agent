-- F1075-F1087: Bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- F1076
  booking_id TEXT UNIQUE NOT NULL, -- F1077: Cal.com bookingId
  contact_id BIGINT REFERENCES voice_agent_contacts(id), -- F1078
  call_id TEXT REFERENCES voice_agent_calls(call_id), -- Link to the call that created this booking
  start_time TIMESTAMPTZ NOT NULL, -- F1081
  end_time TIMESTAMPTZ NOT NULL, -- F1082
  status TEXT NOT NULL DEFAULT 'confirmed', -- F1083: confirmed/cancelled/rescheduled/no-show
  attendee_email TEXT, -- F1084
  attendee_name TEXT, -- F1085
  event_type_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(), -- F1087
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bookings_booking_id ON bookings(booking_id);
CREATE INDEX idx_bookings_contact_id ON bookings(contact_id);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_status ON bookings(status);

-- F1088-F1099: SMS Logs table
CREATE TABLE IF NOT EXISTS sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- F1089
  message_sid TEXT UNIQUE, -- F1090: Twilio messageSid
  to_number TEXT NOT NULL, -- F1091: E.164
  from_number TEXT NOT NULL, -- F1092: E.164
  body TEXT NOT NULL, -- F1093
  status TEXT NOT NULL DEFAULT 'queued', -- F1094: queued/sent/delivered/failed
  contact_id BIGINT REFERENCES voice_agent_contacts(id), -- F0596: CRM contact_id in SMS
  call_id TEXT REFERENCES voice_agent_calls(call_id),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), -- F1099
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_logs_message_sid ON sms_logs(message_sid);
CREATE INDEX idx_sms_logs_to_number ON sms_logs(to_number);
CREATE INDEX idx_sms_logs_contact_id ON sms_logs(contact_id);
CREATE INDEX idx_sms_logs_created_at ON sms_logs(created_at DESC);

-- F1100-F1108: Transcripts table (enhanced version)
-- Drop existing voice_agent_transcripts and create new structure
DROP TABLE IF EXISTS voice_agent_transcripts CASCADE;

CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- F1101
  call_id TEXT UNIQUE NOT NULL REFERENCES voice_agent_calls(call_id) ON DELETE CASCADE, -- F1102: one transcript per call
  content JSONB NOT NULL, -- F1103: Deepgram word-level JSON
  segments JSONB, -- F0447: Array of segments with speaker, text, start, end, words[]
  created_at TIMESTAMPTZ DEFAULT NOW(), -- F1108
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transcripts_call_id ON transcripts(call_id);

-- F1110: Personas table
CREATE TABLE IF NOT EXISTS personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  voice_id TEXT, -- F0763: ElevenLabs voiceId
  system_prompt TEXT,
  first_message TEXT,
  fallback_phrases JSONB,
  vapi_assistant_id TEXT, -- F0785: Link to Vapi assistant
  active BOOLEAN DEFAULT true,
  org_id UUID, -- For multi-tenancy
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_personas_active ON personas(active);
CREATE INDEX idx_personas_vapi_assistant_id ON personas(vapi_assistant_id);

-- F1111: DNC List table
CREATE TABLE IF NOT EXISTS dnc_list (
  phone TEXT PRIMARY KEY, -- E.164 format
  source TEXT, -- 'self-service', 'manual', 'complaint', 'import'
  reason TEXT,
  added_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dnc_list_created_at ON dnc_list(created_at DESC);

-- F1067-F1071: Enhance contacts table with missing columns
ALTER TABLE voice_agent_contacts
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT, -- 'inbound', 'outbound', 'import', 'manual'
  ADD COLUMN IF NOT EXISTS deal_stage TEXT,
  ADD COLUMN IF NOT EXISTS last_contact TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS booking_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS do_not_call BOOLEAN DEFAULT false, -- F1070
  ADD COLUMN IF NOT EXISTS opt_out_sms BOOLEAN DEFAULT false, -- F1071
  ADD COLUMN IF NOT EXISTS tags JSONB,
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- F1041-F1057: Enhance campaigns table with missing columns
ALTER TABLE voice_agent_campaigns
  ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 5, -- F1045
  ADD COLUMN IF NOT EXISTS calling_hours_start TIME, -- F1046
  ADD COLUMN IF NOT EXISTS calling_hours_end TIME, -- F1047
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York', -- F1048
  ADD COLUMN IF NOT EXISTS retry_max INTEGER DEFAULT 3, -- F1050
  ADD COLUMN IF NOT EXISTS voicemail_detection BOOLEAN DEFAULT true, -- F1052
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- F1017-F1040: Enhance voice_agent_calls table
ALTER TABLE voice_agent_calls
  ADD COLUMN IF NOT EXISTS direction TEXT, -- F1020: inbound/outbound
  ADD COLUMN IF NOT EXISTS phone_number TEXT, -- F1022: E.164 caller/callee
  ADD COLUMN IF NOT EXISTS contact_id BIGINT REFERENCES voice_agent_contacts(id), -- F1023
  ADD COLUMN IF NOT EXISTS campaign_id BIGINT REFERENCES voice_agent_campaigns(id), -- F1024
  ADD COLUMN IF NOT EXISTS outcome TEXT, -- F1032: booked/no-answer/voicemail/transferred/dnc
  ADD COLUMN IF NOT EXISTS transfer_to TEXT, -- F0649: Transfer destination
  ADD COLUMN IF NOT EXISTS sentiment TEXT,
  ADD COLUMN IF NOT EXISTS org_id UUID;

-- Add missing indexes for calls table
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_contact_id ON voice_agent_calls(contact_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_campaign_id ON voice_agent_calls(campaign_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_direction ON voice_agent_calls(direction);
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_outcome ON voice_agent_calls(outcome);

-- F1059-F1067: Enhance campaign_contacts table
ALTER TABLE voice_agent_campaign_contacts
  ADD COLUMN IF NOT EXISTS outcome TEXT, -- F1066
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Add RLS policies for new tables
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role all operations on bookings" ON bookings
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on sms_logs" ON sms_logs
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on transcripts" ON transcripts
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on personas" ON personas
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on dnc_list" ON dnc_list
  FOR ALL USING (true);

-- F1120: Migration versioning
COMMENT ON TABLE bookings IS 'v2 - Cal.com booking records';
COMMENT ON TABLE sms_logs IS 'v2 - Twilio SMS logs';
COMMENT ON TABLE transcripts IS 'v2 - Deepgram word-level transcripts';
COMMENT ON TABLE personas IS 'v2 - Agent persona configurations';
COMMENT ON TABLE dnc_list IS 'v2 - Do Not Call list';
