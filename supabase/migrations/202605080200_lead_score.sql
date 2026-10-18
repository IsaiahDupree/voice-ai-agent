-- Sprint 2.1 (PRD §6.2) — lead_score on call_outcomes.
--
-- The agency dashboard's job is to show "qualified leads this week" with
-- a score the SMB can act on. We add three columns to call_outcomes:
--   lead_score          0–100 (NULL when not yet scored)
--   lead_score_reasons  JSONB — array of short reason strings driving the score
--   next_action         short string — what the AI / agency should do next
--
-- Also reconciles the outcome CHECK constraint with the runtime — the
-- earlier seed only enumerated 14 outcomes; lib/packs/outcomes.ts has
-- since added test_drive_booked / soa_captured / etc. Without this fix
-- those inserts would 23514 in prod.

ALTER TABLE call_outcomes
  ADD COLUMN IF NOT EXISTS lead_score INTEGER CHECK (lead_score IS NULL OR lead_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS lead_score_reasons JSONB,
  ADD COLUMN IF NOT EXISTS next_action TEXT;

CREATE INDEX IF NOT EXISTS idx_call_outcomes_lead_score
  ON call_outcomes(tenant_id, lead_score DESC NULLS LAST, created_at DESC);

-- Reconcile the outcome enum. Drop and recreate so we don't have to
-- guess the existing constraint name across environments.
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'call_outcomes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%outcome%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE call_outcomes DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE call_outcomes
  ADD CONSTRAINT call_outcomes_outcome_check CHECK (outcome IN (
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
    'test_drive_booked',
    'service_booked',
    'finance_handoff',
    'appraisal_handoff',
    'recall_logged',
    'rnd_blocked',
    'dnc_blocked',
    'carrier_not_appointed',
    'producer_not_licensed',
    'soa_captured',
    'tpmo_disclosed',
    'coi_issued',
    'fnol_triaged',
    'no_action'
  ));

COMMENT ON COLUMN call_outcomes.lead_score IS '0–100 lead score; null until scorer runs.';
COMMENT ON COLUMN call_outcomes.lead_score_reasons IS 'Short reason strings the scorer credited.';
COMMENT ON COLUMN call_outcomes.next_action IS 'Recommended next action (e.g. schedule_estimate, send_quote_sms).';
