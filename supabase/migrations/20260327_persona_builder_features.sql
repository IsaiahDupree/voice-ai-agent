-- PersonaBuilder P1 Features migration
-- F0770: Prompt variable helpers
-- F0786: Persona apply to campaigns
-- F0789: Persona opening script
-- F0790: Persona closing script
-- F0794: Persona max call duration
-- F0795: Persona silence timeout
-- F0806: Default persona
-- F0813: Persona organization scoping (already exists)
-- F0810: Persona webhook test
-- F0816: Persona test call via API

-- Add new columns to personas table
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS opening_script TEXT,  -- F0789: Opening script
  ADD COLUMN IF NOT EXISTS closing_script TEXT,  -- F0790: Closing script
  ADD COLUMN IF NOT EXISTS max_call_duration_minutes INT DEFAULT 60,  -- F0794: Max duration
  ADD COLUMN IF NOT EXISTS silence_timeout_seconds INT DEFAULT 10,  -- F0795: Silence timeout
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,  -- F0806: Default persona
  ADD COLUMN IF NOT EXISTS webhook_url TEXT,  -- F0810: Webhook test URL
  ADD COLUMN IF NOT EXISTS webhook_secret TEXT;  -- F0810: Webhook secret

-- Create persona_campaigns junction table for F0786: Persona apply to campaigns
CREATE TABLE IF NOT EXISTS persona_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(persona_id, campaign_id)
);

CREATE INDEX idx_persona_campaigns_persona_id ON persona_campaigns(persona_id);
CREATE INDEX idx_persona_campaigns_campaign_id ON persona_campaigns(campaign_id);

-- Create persona_variables table for F0770: Prompt variable helpers
CREATE TABLE IF NOT EXISTS persona_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  example_value TEXT,
  category TEXT, -- 'contact', 'call', 'campaign', 'system'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO persona_variables (name, description, example_value, category) VALUES
  ('{{contact.name}}', 'Contact first name', 'John', 'contact'),
  ('{{contact.phone}}', 'Contact phone number', '+1-555-0123', 'contact'),
  ('{{contact.company}}', 'Contact company name', 'ACME Corp', 'contact'),
  ('{{contact.industry}}', 'Contact industry', 'Technology', 'contact'),
  ('{{call.duration}}', 'Call duration in seconds', '120', 'call'),
  ('{{call.status}}', 'Call status', 'in-progress', 'call'),
  ('{{campaign.name}}', 'Campaign name', 'Q1 Outreach', 'campaign'),
  ('{{campaign.type}}', 'Campaign type', 'sales', 'campaign'),
  ('{{system.time}}', 'Current time', '14:30', 'system'),
  ('{{system.date}}', 'Current date', '2024-03-27', 'system')
ON CONFLICT DO NOTHING;

-- Ensure only one default persona per org
CREATE UNIQUE INDEX idx_personas_default_per_org
ON personas(org_id)
WHERE is_default = true;

-- F0816: Persona test call API - add test_call_logs table
CREATE TABLE IF NOT EXISTS persona_test_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  from_number TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, in-progress, completed, failed
  duration_seconds INT,
  transcript TEXT,
  recording_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_persona_test_calls_persona_id ON persona_test_calls(persona_id);
CREATE INDEX idx_persona_test_calls_status ON persona_test_calls(status);
