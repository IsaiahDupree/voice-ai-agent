-- Assistant Language Variants table
-- Stores multilingual assistant configurations for auto-language switching
CREATE TABLE IF NOT EXISTS assistant_language_variants (
  id BIGSERIAL PRIMARY KEY,
  base_assistant_id TEXT NOT NULL,
  language_code TEXT NOT NULL CHECK (language_code IN ('en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ja')),
  vapi_assistant_id TEXT NOT NULL,
  voice_id TEXT,
  system_prompt_template TEXT,
  stt_language TEXT,
  tts_language TEXT,
  tenant_id TEXT DEFAULT 'default',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(base_assistant_id, language_code, tenant_id)
);

-- Indexes
CREATE INDEX idx_assistant_language_variants_base ON assistant_language_variants(base_assistant_id);
CREATE INDEX idx_assistant_language_variants_language ON assistant_language_variants(language_code);
CREATE INDEX idx_assistant_language_variants_tenant ON assistant_language_variants(tenant_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_assistant_language_variants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER assistant_language_variants_updated_at
  BEFORE UPDATE ON assistant_language_variants
  FOR EACH ROW
  EXECUTE FUNCTION update_assistant_language_variants_updated_at();

-- Comments
COMMENT ON TABLE assistant_language_variants IS 'Stores multilingual assistant configurations for auto-language detection and switching';
COMMENT ON COLUMN assistant_language_variants.base_assistant_id IS 'Reference to the main assistant (typically English)';
COMMENT ON COLUMN assistant_language_variants.language_code IS 'ISO 639-1 language code';
COMMENT ON COLUMN assistant_language_variants.vapi_assistant_id IS 'Vapi assistant ID for this language variant';
COMMENT ON COLUMN assistant_language_variants.voice_id IS 'ElevenLabs voice ID for this language';
