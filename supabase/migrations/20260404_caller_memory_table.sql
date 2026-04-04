-- Caller Memory table
-- Stores per-caller profiles for personalization and relationship tracking
CREATE TABLE IF NOT EXISTS caller_memory (
  id BIGSERIAL PRIMARY KEY,
  phone_number TEXT NOT NULL,
  tenant_id TEXT DEFAULT 'default',
  display_name TEXT,
  call_count INTEGER DEFAULT 0,
  first_call_at TIMESTAMPTZ,
  last_call_at TIMESTAMPTZ,
  summary TEXT,
  preferences JSONB DEFAULT '{}',
  relationship_score INTEGER DEFAULT 0 CHECK (relationship_score >= 0 AND relationship_score <= 100),
  last_offer_made TEXT,
  last_offer_outcome TEXT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(phone_number, tenant_id)
);

-- Indexes
CREATE INDEX idx_caller_memory_phone ON caller_memory(phone_number);
CREATE INDEX idx_caller_memory_tenant_id ON caller_memory(tenant_id);
CREATE INDEX idx_caller_memory_last_call_at ON caller_memory(last_call_at DESC);
CREATE INDEX idx_caller_memory_relationship_score ON caller_memory(relationship_score DESC);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_caller_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER caller_memory_updated_at
  BEFORE UPDATE ON caller_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_caller_memory_updated_at();

-- Comment
COMMENT ON TABLE caller_memory IS 'Stores caller profiles for personalization across calls';
COMMENT ON COLUMN caller_memory.summary IS 'AI-generated rolling summary of relationship and past interactions';
COMMENT ON COLUMN caller_memory.relationship_score IS 'Score from 0-100 indicating relationship strength';
