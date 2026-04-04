-- Add repeat_caller flag to call analytics
-- Marks calls from callers who have called before

-- Add repeat_caller column to voice_agent_calls table
ALTER TABLE voice_agent_calls
ADD COLUMN IF NOT EXISTS repeat_caller BOOLEAN DEFAULT FALSE;

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_repeat_caller
ON voice_agent_calls(repeat_caller);

-- Create index for combined queries (tenant + repeat_caller + created_at)
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_tenant_repeat_created
ON voice_agent_calls(tenant_id, repeat_caller, created_at DESC);

-- Function to automatically set repeat_caller flag
-- This can be called before inserting a call record
CREATE OR REPLACE FUNCTION check_repeat_caller(
  p_phone_number TEXT,
  p_tenant_id TEXT DEFAULT 'default'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_call_count INTEGER;
BEGIN
  -- Count previous calls from this number
  SELECT COUNT(*)
  INTO v_call_count
  FROM voice_agent_calls
  WHERE phone_number = p_phone_number
    AND tenant_id = p_tenant_id
    AND created_at < NOW();

  -- If any previous calls exist, this is a repeat caller
  RETURN v_call_count > 0;
END;
$$;

-- Backfill repeat_caller flag for existing calls
-- This identifies calls where the caller had previous calls
UPDATE voice_agent_calls c1
SET repeat_caller = TRUE
WHERE EXISTS (
  SELECT 1
  FROM voice_agent_calls c2
  WHERE c2.phone_number = c1.phone_number
    AND c2.tenant_id = c1.tenant_id
    AND c2.created_at < c1.created_at
);

-- Comment
COMMENT ON COLUMN voice_agent_calls.repeat_caller IS 'TRUE if caller has called before, FALSE for first-time callers';
COMMENT ON FUNCTION check_repeat_caller IS 'Check if a phone number is a repeat caller for analytics';
