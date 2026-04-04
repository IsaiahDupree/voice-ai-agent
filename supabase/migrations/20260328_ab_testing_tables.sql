-- F0232: Outbound script A/B test
-- F0260: Campaign A/B persona test
-- A/B testing tables

-- A/B tests table
CREATE TABLE IF NOT EXISTS ab_tests (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  test_type TEXT NOT NULL CHECK (test_type IN ('script', 'persona')),
  variants JSONB NOT NULL,
  traffic_split TEXT NOT NULL CHECK (traffic_split IN ('equal', 'weighted')),
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ab_tests_campaign_id ON ab_tests(campaign_id);
CREATE INDEX idx_ab_tests_status ON ab_tests(status);

-- A/B test assignments
CREATE TABLE IF NOT EXISTS ab_test_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id TEXT NOT NULL REFERENCES ab_tests(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL,
  variant_id TEXT NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(test_id, contact_id) -- One assignment per contact per test
);

CREATE INDEX idx_ab_test_assignments_test_id ON ab_test_assignments(test_id);
CREATE INDEX idx_ab_test_assignments_contact_id ON ab_test_assignments(contact_id);
CREATE INDEX idx_ab_test_assignments_variant_id ON ab_test_assignments(variant_id);

-- Add ab_test_variant_id to calls table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calls' AND column_name = 'ab_test_variant_id'
  ) THEN
    ALTER TABLE calls ADD COLUMN ab_test_variant_id TEXT;
    CREATE INDEX idx_calls_ab_test_variant_id ON calls(ab_test_variant_id);
  END IF;
END $$;

-- Comments
COMMENT ON TABLE ab_tests IS 'F0232/F0260: Campaign-level A/B tests for scripts and personas';
COMMENT ON TABLE ab_test_assignments IS 'Tracks which variant each contact was assigned to';
COMMENT ON COLUMN ab_tests.test_type IS 'Type of test: script (F0232) or persona (F0260)';
COMMENT ON COLUMN ab_tests.traffic_split IS 'How traffic is distributed: equal 50/50 or weighted per variant.weight';
COMMENT ON COLUMN ab_tests.variants IS 'Array of variant configs: [{id, name, weight, config}, ...]';
