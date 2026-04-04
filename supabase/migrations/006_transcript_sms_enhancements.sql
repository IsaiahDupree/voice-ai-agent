-- F0501: Transcript ingestion queue table
CREATE TABLE IF NOT EXISTS voice_agent_transcript_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT UNIQUE NOT NULL REFERENCES voice_agent_calls(call_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending/processing/completed/failed
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  deepgram_response JSONB, -- Raw Deepgram response to process
  last_error TEXT,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_transcript_queue_status ON voice_agent_transcript_queue(status);
CREATE INDEX idx_transcript_queue_created_at ON voice_agent_transcript_queue(created_at);
CREATE INDEX idx_transcript_queue_pending ON voice_agent_transcript_queue(status, created_at) WHERE status = 'pending';

-- F0501: Function to get queue stats
CREATE OR REPLACE FUNCTION get_transcript_queue_stats()
RETURNS TABLE (
  pending BIGINT,
  processing BIGINT,
  completed BIGINT,
  failed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending') AS pending,
    COUNT(*) FILTER (WHERE status = 'processing') AS processing,
    COUNT(*) FILTER (WHERE status = 'completed') AS completed,
    COUNT(*) FILTER (WHERE status = 'failed') AS failed
  FROM voice_agent_transcript_queue;
END;
$$ LANGUAGE plpgsql;

-- F0552, F0551, F0546: Enhance sms_logs table
ALTER TABLE sms_logs
  ADD COLUMN IF NOT EXISTS error_code TEXT, -- F0552: Twilio error code
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0, -- Retry attempts
  ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'outbound', -- inbound/outbound
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ, -- F0551: Timezone-aware scheduling
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false; -- F0546: Test mode flag

-- F0552: Index for error tracking
CREATE INDEX IF NOT EXISTS idx_sms_logs_error_code ON sms_logs(error_code) WHERE error_code IS NOT NULL;

-- F0551: Index for scheduled SMS
CREATE INDEX IF NOT EXISTS idx_sms_logs_scheduled ON sms_logs(scheduled_for) WHERE scheduled_for IS NOT NULL;

-- Rename sms_logs to voice_agent_sms_logs for consistency
ALTER TABLE sms_logs RENAME TO voice_agent_sms_logs;

-- Rename indexes
ALTER INDEX idx_sms_logs_message_sid RENAME TO idx_voice_agent_sms_logs_message_sid;
ALTER INDEX idx_sms_logs_to_number RENAME TO idx_voice_agent_sms_logs_to_number;
ALTER INDEX idx_sms_logs_contact_id RENAME TO idx_voice_agent_sms_logs_contact_id;
ALTER INDEX idx_sms_logs_created_at RENAME TO idx_voice_agent_sms_logs_created_at;
ALTER INDEX idx_sms_logs_error_code RENAME TO idx_voice_agent_sms_logs_error_code;
ALTER INDEX idx_sms_logs_scheduled RENAME TO idx_voice_agent_sms_logs_scheduled;

-- F0555: Function to check PII in SMS body
CREATE OR REPLACE FUNCTION check_sms_pii(body TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check for SSN pattern (XXX-XX-XXXX)
  IF body ~ '\d{3}-\d{2}-\d{4}' THEN
    RETURN TRUE;
  END IF;

  -- Check for credit card pattern (4-4-4-4 digits)
  IF body ~ '\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}' THEN
    RETURN TRUE;
  END IF;

  -- Check for password/credential keywords
  IF body ~* '(password|pwd|secret|api[_\s]?key|token)[\s:=]+\S+' THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- F0563: SMS unsubscribe tracking table
CREATE TABLE IF NOT EXISTS voice_agent_sms_unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL, -- E.164 format
  reason TEXT,
  source TEXT DEFAULT 'web', -- web/reply/manual
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_unsubscribes_phone ON voice_agent_sms_unsubscribes(phone);

-- F0585, F0586: Contact import/export audit log
CREATE TABLE IF NOT EXISTS voice_agent_contact_import_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT,
  source TEXT, -- csv/api/manual
  total_rows INTEGER,
  imported_rows INTEGER,
  failed_rows INTEGER,
  errors JSONB, -- Array of error messages
  imported_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contact_import_log_created_at ON voice_agent_contact_import_log(created_at DESC);

-- F0484, F0485: Add metadata field to transcripts for channel and timing data
ALTER TABLE transcripts
  ADD COLUMN IF NOT EXISTS metadata JSONB;

CREATE INDEX IF NOT EXISTS idx_transcripts_metadata ON transcripts USING gin(metadata);

-- F0482: Add retention policy fields to calls table
ALTER TABLE voice_agent_calls
  ADD COLUMN IF NOT EXISTS retention_exempt BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS exemption_reason TEXT,
  ADD COLUMN IF NOT EXISTS exempted_at TIMESTAMPTZ;

-- F0501: RPC to increment retry count (used by SMS retry logic)
CREATE OR REPLACE FUNCTION increment_sms_retry_count(p_message_sid TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE voice_agent_sms_logs
  SET
    retry_count = retry_count + 1,
    last_retry_at = NOW()
  WHERE message_sid = p_message_sid;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS on new tables
ALTER TABLE voice_agent_transcript_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_sms_unsubscribes ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_contact_import_log ENABLE ROW LEVEL SECURITY;

-- Allow service role all operations
CREATE POLICY "Allow service role all operations on transcript_queue" ON voice_agent_transcript_queue
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on sms_unsubscribes" ON voice_agent_sms_unsubscribes
  FOR ALL USING (true);

CREATE POLICY "Allow service role all operations on contact_import_log" ON voice_agent_contact_import_log
  FOR ALL USING (true);

COMMENT ON TABLE voice_agent_transcript_queue IS 'F0501: Queue for reliable transcript processing with retry';
COMMENT ON TABLE voice_agent_sms_unsubscribes IS 'F0563: SMS opt-out tracking';
COMMENT ON TABLE voice_agent_contact_import_log IS 'F0585, F0586: Contact import/export audit log';
