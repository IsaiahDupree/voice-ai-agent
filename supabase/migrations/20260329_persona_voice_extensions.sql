-- PersonaBuilder Voice Extensions (Phase 1)
-- F0768: Custom voice clone
-- F0791: Speaking rate
-- F0792: Stability
-- F0793: Interrupt sensitivity
-- F0799: Tags
-- F0800: Last used date
-- F0801: Call count
-- F0809: Change log
-- F0812: Background sound
-- F0811: Language override

-- Extend personas table with voice and configuration fields
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS voice_clone_id TEXT, -- F0768: ElevenLabs voice clone ID
  ADD COLUMN IF NOT EXISTS voice_sample_url TEXT, -- F0768: URL to voice sample for cloning
  ADD COLUMN IF NOT EXISTS speaking_rate DECIMAL(3,2) DEFAULT 1.0, -- F0791: 0.5-2.0
  ADD COLUMN IF NOT EXISTS stability DECIMAL(3,2) DEFAULT 0.5, -- F0792: 0-1
  ADD COLUMN IF NOT EXISTS interrupt_sensitivity DECIMAL(3,2) DEFAULT 0.5, -- F0793: Barge-in threshold
  ADD COLUMN IF NOT EXISTS background_sound_id TEXT, -- F0812: ID of ambient sound
  ADD COLUMN IF NOT EXISTS background_sound_url TEXT, -- F0812: URL to audio file
  ADD COLUMN IF NOT EXISTS language_override TEXT, -- F0811: e.g. 'en-US', 'es-ES'
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ, -- F0800: Last call timestamp
  ADD COLUMN IF NOT EXISTS call_count INT DEFAULT 0, -- F0801: Total calls
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id), -- For change log
  ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id); -- For change log

-- Create persona_tags table for F0799
CREATE TABLE IF NOT EXISTS persona_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(persona_id, tag)
);

CREATE INDEX idx_persona_tags_persona_id ON persona_tags(persona_id);
CREATE INDEX idx_persona_tags_tag ON persona_tags(tag);

-- Create persona_changelog table for F0809
CREATE TABLE IF NOT EXISTS persona_changelog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID REFERENCES auth.users(id),
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_persona_changelog_persona_id ON persona_changelog(persona_id);
CREATE INDEX idx_persona_changelog_created_at ON persona_changelog(created_at);

-- Create persona_activation_history table for F0815
CREATE TABLE IF NOT EXISTS persona_activation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  activated_by UUID REFERENCES auth.users(id),
  deactivated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_persona_activation_history_persona_id ON persona_activation_history(persona_id);

-- Create background_sounds lookup table for F0812
CREATE TABLE IF NOT EXISTS background_sounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT, -- 'office', 'coffee_shop', 'street', 'nature', 'silence'
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO background_sounds (name, url, category, duration_seconds) VALUES
  ('Office Ambience', 'https://cdn.example.com/ambient/office.mp3', 'office', 120),
  ('Coffee Shop', 'https://cdn.example.com/ambient/coffee.mp3', 'coffee_shop', 120),
  ('Street Traffic', 'https://cdn.example.com/ambient/street.mp3', 'street', 120),
  ('Nature/Birds', 'https://cdn.example.com/ambient/nature.mp3', 'nature', 120),
  ('Silence', '', 'silence', 0)
ON CONFLICT DO NOTHING;
