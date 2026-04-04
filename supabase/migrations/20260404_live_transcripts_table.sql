-- Live Transcripts table
-- Stores real-time transcript chunks for SSE streaming to dashboard
CREATE TABLE IF NOT EXISTS live_transcripts (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL,
  tenant_id TEXT DEFAULT 'default',
  speaker TEXT NOT NULL CHECK (speaker IN ('agent', 'caller', 'system')),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  sequence_num INTEGER NOT NULL,
  sentiment_score DECIMAL(3, 2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  confidence DECIMAL(5, 4),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_live_transcripts_call_id ON live_transcripts(call_id);
CREATE INDEX idx_live_transcripts_tenant_id ON live_transcripts(tenant_id);
CREATE INDEX idx_live_transcripts_timestamp ON live_transcripts(call_id, timestamp);
CREATE INDEX idx_live_transcripts_sequence ON live_transcripts(call_id, sequence_num);

-- Comment
COMMENT ON TABLE live_transcripts IS 'Real-time transcript chunks for live call monitoring';
COMMENT ON COLUMN live_transcripts.sentiment_score IS 'Sentiment score from -1 (negative) to 1 (positive)';
COMMENT ON COLUMN live_transcripts.sequence_num IS 'Sequence number for ordering chunks within a call';
