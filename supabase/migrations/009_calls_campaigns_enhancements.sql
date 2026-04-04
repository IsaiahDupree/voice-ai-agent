-- Migration 009: Calls and Campaigns Enhancements
-- Implements Database P1 features: F1025, F1028, F1029, F1031, F1033, F1034, F1035, F1038, F1039
-- F1049, F1051, F1053, F1054, F1055, F1056

-- ============================================================================
-- CALLS TABLE ENHANCEMENTS
-- ============================================================================

-- F1025: persona_id column (UUID FK personas.id nullable)
ALTER TABLE voice_agent_calls
ADD COLUMN IF NOT EXISTS persona_id UUID;

-- F1028: recording_url column (already exists in 001, ensure it's TEXT nullable)
-- Already exists, no action needed

-- F1029: transfer_to column (TEXT nullable transfer destination)
ALTER TABLE voice_agent_calls
ADD COLUMN IF NOT EXISTS transfer_to TEXT;

-- F1031: sentiment column (TEXT positive/neutral/negative)
ALTER TABLE voice_agent_calls
ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative'));

-- F1033: end_reason column (already exists in 001, ensure proper values)
-- Update constraint to include all expected values
ALTER TABLE voice_agent_calls
DROP CONSTRAINT IF EXISTS voice_agent_calls_end_reason_check;

ALTER TABLE voice_agent_calls
ADD CONSTRAINT voice_agent_calls_end_reason_check
CHECK (end_reason IN ('completed', 'dropped', 'transferred', 'max-duration', 'caller-hangup', 'agent-hangup', 'error', 'voicemail', 'no-answer', 'busy'));

-- F1034: summary column (TEXT AI-generated call summary)
ALTER TABLE voice_agent_calls
ADD COLUMN IF NOT EXISTS summary TEXT;

-- F1035: metadata column (JSONB already exists in 001)
-- Already exists, no action needed

-- F1038: org_id column (UUID FK organizations.id)
ALTER TABLE voice_agent_calls
ADD COLUMN IF NOT EXISTS org_id UUID;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_persona_id ON voice_agent_calls(persona_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_sentiment ON voice_agent_calls(sentiment);
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_org_id ON voice_agent_calls(org_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_end_reason ON voice_agent_calls(end_reason);

-- F1039: calls RLS (Row Level Security by org_id)
-- Drop existing catch-all policy and add org-scoped policy
DROP POLICY IF EXISTS "Allow service role all operations on calls" ON voice_agent_calls;

-- Service role policy (full access)
CREATE POLICY "voice_agent_calls_service_role_policy" ON voice_agent_calls
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Org-scoped policy for authenticated users
CREATE POLICY "voice_agent_calls_org_policy" ON voice_agent_calls
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
-- CAMPAIGNS TABLE ENHANCEMENTS
-- ============================================================================

-- F1049: calling_days (TEXT[] default Mon-Fri)
ALTER TABLE voice_agent_campaigns
ADD COLUMN IF NOT EXISTS calling_days TEXT[] DEFAULT ARRAY['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

-- F1051: retry_delay_minutes (INTEGER default 60)
ALTER TABLE voice_agent_campaigns
ADD COLUMN IF NOT EXISTS retry_delay_minutes INTEGER DEFAULT 60;

-- F1053: voicemail_drop_url (TEXT nullable)
ALTER TABLE voice_agent_campaigns
ADD COLUMN IF NOT EXISTS voicemail_drop_url TEXT;

-- F1054: persona_id (UUID FK personas.id nullable)
ALTER TABLE voice_agent_campaigns
ADD COLUMN IF NOT EXISTS persona_id UUID;

-- F1055: start_at (TIMESTAMPTZ nullable scheduled start)
ALTER TABLE voice_agent_campaigns
ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ;

-- F1056: end_date (DATE nullable)
ALTER TABLE voice_agent_campaigns
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_voice_agent_campaigns_persona_id ON voice_agent_campaigns(persona_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_campaigns_start_at ON voice_agent_campaigns(start_at);
CREATE INDEX IF NOT EXISTS idx_voice_agent_campaigns_end_date ON voice_agent_campaigns(end_date);

-- Function to check if campaign is within active date range
CREATE OR REPLACE FUNCTION is_campaign_active(campaign_row voice_agent_campaigns)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if campaign is within start_at and end_date range
  IF campaign_row.start_at IS NOT NULL AND NOW() < campaign_row.start_at THEN
    RETURN FALSE;
  END IF;

  IF campaign_row.end_date IS NOT NULL AND CURRENT_DATE > campaign_row.end_date THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if current day is in calling_days
CREATE OR REPLACE FUNCTION is_calling_day_allowed(calling_days TEXT[])
RETURNS BOOLEAN AS $$
DECLARE
  current_day TEXT;
BEGIN
  -- Get current day of week (e.g., 'Monday')
  current_day := TO_CHAR(NOW(), 'Day');
  current_day := TRIM(current_day);

  -- Check if current day is in allowed calling days
  RETURN current_day = ANY(calling_days);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN voice_agent_calls.persona_id IS 'F1025: FK to personas table, defines agent persona used for this call';
COMMENT ON COLUMN voice_agent_calls.transfer_to IS 'F1029: Phone number or destination the call was transferred to';
COMMENT ON COLUMN voice_agent_calls.sentiment IS 'F1031: Overall call sentiment derived from transcript analysis';
COMMENT ON COLUMN voice_agent_calls.summary IS 'F1034: AI-generated summary of call content and outcomes';
COMMENT ON COLUMN voice_agent_calls.org_id IS 'F1038: Organization ID for multi-tenant isolation';

COMMENT ON COLUMN voice_agent_campaigns.calling_days IS 'F1049: Days of week when calls are allowed (e.g., Monday, Tuesday)';
COMMENT ON COLUMN voice_agent_campaigns.retry_delay_minutes IS 'F1051: Minimum delay in minutes before retrying a failed call';
COMMENT ON COLUMN voice_agent_campaigns.voicemail_drop_url IS 'F1053: URL to audio file to drop when voicemail is detected';
COMMENT ON COLUMN voice_agent_campaigns.persona_id IS 'F1054: FK to personas table, defines agent persona for all campaign calls';
COMMENT ON COLUMN voice_agent_campaigns.start_at IS 'F1055: Scheduled start time for campaign execution';
COMMENT ON COLUMN voice_agent_campaigns.end_date IS 'F1056: Campaign end date after which no more calls will be made';
