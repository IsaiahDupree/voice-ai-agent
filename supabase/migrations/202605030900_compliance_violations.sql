-- Compliance violations log — server-side runtime classifier
CREATE TABLE IF NOT EXISTS compliance_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT,
  tenant_id TEXT,
  pack_install_id UUID REFERENCES tenant_pack_installs(id) ON DELETE SET NULL,
  compliance_profile_slug TEXT,
  rule TEXT NOT NULL,
  matched_phrase TEXT,
  utterance TEXT NOT NULL,
  redacted_utterance TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('warning','blocked')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_violations_call_id
  ON compliance_violations(call_id);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_tenant
  ON compliance_violations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_severity
  ON compliance_violations(severity);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_created_at
  ON compliance_violations(created_at DESC);

ALTER TABLE compliance_violations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role full access compliance_violations" ON compliance_violations;
CREATE POLICY "service role full access compliance_violations" ON compliance_violations
  FOR ALL USING (true);
