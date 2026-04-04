-- Voice Agent Calls table
CREATE TABLE IF NOT EXISTS voice_agent_calls (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT UNIQUE NOT NULL,
  assistant_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  from_number TEXT,
  to_number TEXT,
  end_reason TEXT,
  cost DECIMAL(10, 4),
  transcript TEXT,
  recording_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_calls_call_id ON voice_agent_calls(call_id);
CREATE INDEX idx_voice_agent_calls_status ON voice_agent_calls(status);
CREATE INDEX idx_voice_agent_calls_started_at ON voice_agent_calls(started_at DESC);

-- Voice Agent Transcripts table
CREATE TABLE IF NOT EXISTS voice_agent_transcripts (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES voice_agent_calls(call_id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence DECIMAL(5, 4),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_transcripts_call_id ON voice_agent_transcripts(call_id);
CREATE INDEX idx_voice_agent_transcripts_timestamp ON voice_agent_transcripts(timestamp);

-- Voice Agent Function Calls table
CREATE TABLE IF NOT EXISTS voice_agent_function_calls (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES voice_agent_calls(call_id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  parameters JSONB,
  result JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_function_calls_call_id ON voice_agent_function_calls(call_id);
CREATE INDEX idx_voice_agent_function_calls_function_name ON voice_agent_function_calls(function_name);

-- Voice Agent Contacts table
CREATE TABLE IF NOT EXISTS voice_agent_contacts (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_contacts_phone ON voice_agent_contacts(phone);
CREATE INDEX idx_voice_agent_contacts_email ON voice_agent_contacts(email);

-- Voice Agent Campaigns table
CREATE TABLE IF NOT EXISTS voice_agent_campaigns (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  assistant_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  schedule JSONB,
  calling_window JSONB,
  max_calls_per_day INTEGER,
  voicemail_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_voice_agent_campaigns_status ON voice_agent_campaigns(status);

-- Voice Agent Campaign Contacts table
CREATE TABLE IF NOT EXISTS voice_agent_campaign_contacts (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT REFERENCES voice_agent_campaigns(id) ON DELETE CASCADE,
  contact_id BIGINT REFERENCES voice_agent_contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_call_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_voice_agent_campaign_contacts_campaign_id ON voice_agent_campaign_contacts(campaign_id);
CREATE INDEX idx_voice_agent_campaign_contacts_status ON voice_agent_campaign_contacts(status);

-- Enable Row Level Security (RLS)
ALTER TABLE voice_agent_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_function_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_campaign_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for service role, restrict for anon)
CREATE POLICY "Allow service role all operations on calls" ON voice_agent_calls
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on transcripts" ON voice_agent_transcripts
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on function_calls" ON voice_agent_function_calls
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on contacts" ON voice_agent_contacts
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on campaigns" ON voice_agent_campaigns
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on campaign_contacts" ON voice_agent_campaign_contacts
  FOR ALL USING (true);
