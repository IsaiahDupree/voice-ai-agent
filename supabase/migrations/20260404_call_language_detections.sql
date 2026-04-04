-- Call Language Detections table
-- Tracks language detection events during calls for analytics and debugging
CREATE TABLE IF NOT EXISTS call_language_detections (
  id BIGSERIAL PRIMARY KEY,
  call_id TEXT NOT NULL,
  detected_language TEXT NOT NULL,
  confidence DECIMAL(5, 4) CHECK (confidence >= 0 AND confidence <= 1),
  switched_at TIMESTAMPTZ,
  switched_from_assistant_id TEXT,
  switched_to_assistant_id TEXT,
  detection_method TEXT CHECK (detection_method IN ('automatic', 'manual', 'fallback')),
  transcript_sample TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_call_language_detections_call_id ON call_language_detections(call_id);
CREATE INDEX idx_call_language_detections_language ON call_language_detections(detected_language);
CREATE INDEX idx_call_language_detections_switched_at ON call_language_detections(switched_at);

-- Comments
COMMENT ON TABLE call_language_detections IS 'Tracks language detection events and mid-call language switches';
COMMENT ON COLUMN call_language_detections.confidence IS 'Language detection confidence from 0.0 to 1.0';
COMMENT ON COLUMN call_language_detections.switched_at IS 'Timestamp when assistant was switched to language variant';
COMMENT ON COLUMN call_language_detections.detection_method IS 'How language was detected: automatic, manual, or fallback';
