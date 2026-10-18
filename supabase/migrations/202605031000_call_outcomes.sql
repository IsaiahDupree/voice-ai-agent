-- Pack telemetry — per-call outcomes for ROI rollup.
-- Each pack tool can write at most one canonical outcome per call;
-- analytics groups them per pack_install for the dashboard tile.

CREATE TABLE IF NOT EXISTS call_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  pack_install_id UUID REFERENCES tenant_pack_installs(id) ON DELETE SET NULL,
  pack_slug TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'booked',
    'rescheduled',
    'cancelled',
    'transferred',
    'voicemail',
    'emergency_escalated',
    'allergen_flagged',
    'life_safety_interrupted',
    'refill_requested',
    'insurance_verified',
    'missed_call_recovered',
    'review_requested',
    'qualified_lead',
    'no_action'
  )),
  revenue_estimate_cents INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (call_id, outcome)
);

CREATE INDEX IF NOT EXISTS idx_call_outcomes_pack_install
  ON call_outcomes(pack_install_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_outcomes_tenant
  ON call_outcomes(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_outcomes_outcome
  ON call_outcomes(outcome);

ALTER TABLE call_outcomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role full access call_outcomes" ON call_outcomes;
CREATE POLICY "service role full access call_outcomes" ON call_outcomes FOR ALL USING (true);
