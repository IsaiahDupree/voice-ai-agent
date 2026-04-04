-- Speech Classifications table
-- Stores semantic VAD classifications for analytics and tuning
CREATE TABLE IF NOT EXISTS speech_classifications (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL,
  assistant_id TEXT,
  utterance TEXT NOT NULL,
  classification_type TEXT NOT NULL CHECK (classification_type IN ('real-interrupt', 'filler', 'affirmation', 'side-comment')),
  confidence DECIMAL(3, 2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  reasoning TEXT,
  agent_speaking BOOLEAN DEFAULT TRUE,
  conversation_stage TEXT,
  sensitivity TEXT DEFAULT 'medium' CHECK (sensitivity IN ('low', 'medium', 'high')),
  pause_triggered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX idx_speech_classifications_call_id ON speech_classifications(call_id);
CREATE INDEX idx_speech_classifications_assistant_id ON speech_classifications(assistant_id);
CREATE INDEX idx_speech_classifications_type ON speech_classifications(classification_type);
CREATE INDEX idx_speech_classifications_created_at ON speech_classifications(created_at DESC);
CREATE INDEX idx_speech_classifications_pause_triggered ON speech_classifications(pause_triggered) WHERE pause_triggered = TRUE;

-- Comment
COMMENT ON TABLE speech_classifications IS 'Stores utterance classifications from semantic VAD for interruption detection analytics';
COMMENT ON COLUMN speech_classifications.classification_type IS 'Type of utterance: real-interrupt, filler, affirmation, or side-comment';
COMMENT ON COLUMN speech_classifications.confidence IS 'Classification confidence score from 0.0 to 1.0';
COMMENT ON COLUMN speech_classifications.pause_triggered IS 'Whether this classification triggered an agent pause';
