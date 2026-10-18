-- Sprint 2.4 (PRD §6.2) — post-call follow-up audit table.
--
-- Every time the lead scorer picks a next_action that triggers an
-- outbound contact (SMS today, email later), we log it here so the
-- agency can see WHAT was sent, WHEN, and WHY (which call + score).
-- Distinct from voice_agent_scheduled_sms (the delivery queue) — this
-- is the decision/audit layer.

CREATE TABLE IF NOT EXISTS post_call_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  pack_install_id UUID,
  pack_slug TEXT,
  next_action TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms','email','none')),
  template_name TEXT,
  rendered_body TEXT,
  to_phone TEXT,
  to_email TEXT,
  scheduled_for TIMESTAMPTZ,
  delivery_id TEXT,
  lead_score INTEGER,
  -- 'queued' before send, 'sent' after, 'skipped' if guardrail tripped (no consent / no number / DNC).
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','skipped','failed')),
  skip_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_call_followups_tenant
  ON post_call_followups(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_call_followups_call
  ON post_call_followups(call_id);
CREATE INDEX IF NOT EXISTS idx_post_call_followups_status
  ON post_call_followups(status);

ALTER TABLE post_call_followups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service role full access post_call_followups" ON post_call_followups;
CREATE POLICY "service role full access post_call_followups" ON post_call_followups FOR ALL USING (true);

COMMENT ON TABLE post_call_followups IS 'Audit + decision log for AI-initiated post-call follow-ups (PRD §6.2 S2.4).';
COMMENT ON COLUMN post_call_followups.skip_reason IS 'Why the follow-up was skipped: no_phone | no_consent | on_dnc | no_template | tenant_disabled.';
