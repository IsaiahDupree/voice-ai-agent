-- Migration 010: Additional Columns for Campaigns, Contacts, Bookings, SMS, Transcripts
-- Implements Database P1 features: F1058, F1065, F1069, F1073, F1074, F1079, F1080
-- F1095, F1096, F1097, F1098, F1104, F1105, F1106, F1107

-- ============================================================================
-- CAMPAIGNS TABLE
-- ============================================================================

-- F1058: org_id column (UUID FK organizations.id)
ALTER TABLE voice_agent_campaigns
ADD COLUMN IF NOT EXISTS org_id UUID;

CREATE INDEX IF NOT EXISTS idx_voice_agent_campaigns_org_id ON voice_agent_campaigns(org_id);

-- Add RLS for campaigns by org_id
DROP POLICY IF EXISTS "Allow service role all operations on campaigns" ON voice_agent_campaigns;

CREATE POLICY "voice_agent_campaigns_service_role_policy" ON voice_agent_campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "voice_agent_campaigns_org_policy" ON voice_agent_campaigns
  FOR ALL
  TO authenticated
  USING (
    org_id IS NULL OR
    org_id = current_setting('app.current_org_id', true)::uuid
  )
  WITH CHECK (
    org_id IS NULL OR
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- ============================================================================
-- CAMPAIGN CONTACTS TABLE
-- ============================================================================

-- F1065: last_attempt_at (TIMESTAMPTZ nullable) - already exists in 001
-- Verify it exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_agent_campaign_contacts'
    AND column_name = 'last_attempt_at'
  ) THEN
    ALTER TABLE voice_agent_campaign_contacts
    ADD COLUMN last_attempt_at TIMESTAMPTZ;
  END IF;
END $$;

-- ============================================================================
-- CONTACTS TABLE
-- ============================================================================

-- F1069: deal_stage (TEXT default lead)
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS deal_stage TEXT DEFAULT 'lead'
CHECK (deal_stage IN ('lead', 'contacted', 'qualified', 'demo', 'proposal', 'negotiation', 'closed-won', 'closed-lost', 'nurture'));

CREATE INDEX IF NOT EXISTS idx_voice_agent_contacts_deal_stage ON voice_agent_contacts(deal_stage);

-- F1073: notes (JSONB default empty array)
-- Rename existing TEXT notes column to notes_text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_agent_contacts'
    AND column_name = 'notes'
    AND data_type = 'text'
  ) THEN
    ALTER TABLE voice_agent_contacts RENAME COLUMN notes TO notes_text;
  END IF;
END $$;

-- Add new JSONB notes column
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'::jsonb;

-- Migrate old notes_text to new JSONB structure
UPDATE voice_agent_contacts
SET notes = jsonb_build_array(
  jsonb_build_object(
    'text', notes_text,
    'created_at', created_at,
    'author', 'system'
  )
)
WHERE notes_text IS NOT NULL AND notes_text != '' AND notes = '[]'::jsonb;

-- F1074: contacts RLS (Row Level Security by org_id)
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS org_id UUID;

CREATE INDEX IF NOT EXISTS idx_voice_agent_contacts_org_id ON voice_agent_contacts(org_id);

-- Drop existing catch-all policy and add org-scoped policy
DROP POLICY IF EXISTS "Allow service role all operations on contacts" ON voice_agent_contacts;

CREATE POLICY "voice_agent_contacts_service_role_policy" ON voice_agent_contacts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "voice_agent_contacts_org_policy" ON voice_agent_contacts
  FOR ALL
  TO authenticated
  USING (
    org_id IS NULL OR
    org_id = current_setting('app.current_org_id', true)::uuid
  )
  WITH CHECK (
    org_id IS NULL OR
    org_id = current_setting('app.current_org_id', true)::uuid
  );

-- ============================================================================
-- BOOKINGS TABLE
-- ============================================================================

-- Create bookings table if it doesn't exist
CREATE TABLE IF NOT EXISTS voice_agent_bookings (
  id BIGSERIAL PRIMARY KEY,
  booking_id TEXT UNIQUE NOT NULL,
  contact_id BIGINT REFERENCES voice_agent_contacts(id),
  event_type TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed', 'no-show')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- F1079: call_id (UUID FK voice_agent_calls.id nullable)
ALTER TABLE voice_agent_bookings
ADD COLUMN IF NOT EXISTS call_id TEXT REFERENCES voice_agent_calls(call_id);

-- F1080: event_type_id (INTEGER Cal.com event type)
ALTER TABLE voice_agent_bookings
ADD COLUMN IF NOT EXISTS event_type_id INTEGER;

CREATE INDEX IF NOT EXISTS idx_voice_agent_bookings_call_id ON voice_agent_bookings(call_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_bookings_event_type_id ON voice_agent_bookings(event_type_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_bookings_contact_id ON voice_agent_bookings(contact_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_bookings_scheduled_at ON voice_agent_bookings(scheduled_at);

-- Enable RLS on bookings
ALTER TABLE voice_agent_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voice_agent_bookings_service_role_policy" ON voice_agent_bookings
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- SMS LOGS TABLE
-- ============================================================================

-- F1095: template_slug (TEXT nullable)
ALTER TABLE voice_agent_sms_logs
ADD COLUMN IF NOT EXISTS template_slug TEXT;

-- F1096: contact_id (UUID FK nullable)
ALTER TABLE voice_agent_sms_logs
ADD COLUMN IF NOT EXISTS contact_id BIGINT REFERENCES voice_agent_contacts(id);

-- F1097: call_id (UUID FK nullable)
ALTER TABLE voice_agent_sms_logs
ADD COLUMN IF NOT EXISTS call_id TEXT REFERENCES voice_agent_calls(call_id);

-- F1098: campaign_id (UUID FK nullable)
ALTER TABLE voice_agent_sms_logs
ADD COLUMN IF NOT EXISTS campaign_id BIGINT REFERENCES voice_agent_campaigns(id);

CREATE INDEX IF NOT EXISTS idx_voice_agent_sms_logs_template_slug ON voice_agent_sms_logs(template_slug);
CREATE INDEX IF NOT EXISTS idx_voice_agent_sms_logs_contact_id ON voice_agent_sms_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_sms_logs_call_id ON voice_agent_sms_logs(call_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_sms_logs_campaign_id ON voice_agent_sms_logs(campaign_id);

-- ============================================================================
-- TRANSCRIPTS TABLE
-- ============================================================================

-- F1104: plain_text (TEXT readable transcript)
ALTER TABLE voice_agent_transcripts
ADD COLUMN IF NOT EXISTS plain_text TEXT;

-- F1105: summary (TEXT AI summary)
ALTER TABLE voice_agent_transcripts
ADD COLUMN IF NOT EXISTS summary TEXT;

-- F1106: sentiment (TEXT)
ALTER TABLE voice_agent_transcripts
ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative'));

-- F1107: metadata (JSONB word_count, keywords, etc)
ALTER TABLE voice_agent_transcripts
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_voice_agent_transcripts_sentiment ON voice_agent_transcripts(sentiment);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN voice_agent_campaigns.org_id IS 'F1058: Organization ID for multi-tenant isolation';
COMMENT ON COLUMN voice_agent_contacts.deal_stage IS 'F1069: Current stage in sales pipeline';
COMMENT ON COLUMN voice_agent_contacts.notes IS 'F1073: Array of note objects with text, timestamp, author';
COMMENT ON COLUMN voice_agent_contacts.org_id IS 'F1074: Organization ID for multi-tenant isolation';
COMMENT ON COLUMN voice_agent_bookings.call_id IS 'F1079: Call that resulted in this booking';
COMMENT ON COLUMN voice_agent_bookings.event_type_id IS 'F1080: Cal.com event type ID';
COMMENT ON COLUMN voice_agent_sms_logs.template_slug IS 'F1095: Template used for this SMS';
COMMENT ON COLUMN voice_agent_sms_logs.contact_id IS 'F1096: Contact this SMS was sent to';
COMMENT ON COLUMN voice_agent_sms_logs.call_id IS 'F1097: Call that triggered this SMS';
COMMENT ON COLUMN voice_agent_sms_logs.campaign_id IS 'F1098: Campaign this SMS belongs to';
COMMENT ON COLUMN voice_agent_transcripts.plain_text IS 'F1104: Human-readable plain text transcript';
COMMENT ON COLUMN voice_agent_transcripts.summary IS 'F1105: AI-generated summary of transcript';
COMMENT ON COLUMN voice_agent_transcripts.sentiment IS 'F1106: Overall sentiment of transcript';
COMMENT ON COLUMN voice_agent_transcripts.metadata IS 'F1107: Additional metadata (word_count, keywords, duration, etc)';
