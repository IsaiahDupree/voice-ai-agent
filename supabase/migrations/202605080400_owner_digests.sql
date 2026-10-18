-- Sprint 3 (PRD §6.3) — owner digest schema.
--
-- Two tables:
--   digest_subscriptions  — who gets digests, how often, last sent
--   digest_sends          — audit log of every send attempt (success + failed)
--
-- The agency provisions a subscription per client; the cron picks rows
-- where last_sent_at < (NOW - interval) and queues a render+send.

CREATE TABLE IF NOT EXISTS digest_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (frequency IN ('daily','weekly','off')),
  -- Hour of day in tenant's local time (0–23) when daily/weekly should fire.
  send_hour_local INTEGER NOT NULL DEFAULT 8 CHECK (send_hour_local BETWEEN 0 AND 23),
  -- For weekly: 0=Sunday … 6=Saturday. Ignored for daily.
  send_day_of_week INTEGER NOT NULL DEFAULT 1 CHECK (send_day_of_week BETWEEN 0 AND 6),
  last_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_digest_subs_tenant ON digest_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_digest_subs_due
  ON digest_subscriptions(frequency, last_sent_at)
  WHERE frequency != 'off';

CREATE TABLE IF NOT EXISTS digest_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES digest_subscriptions(id) ON DELETE SET NULL,
  tenant_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  -- Window the digest covers (start..end).
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  -- Snapshot of the rolled-up numbers — useful for back-tests / re-renders.
  payload JSONB NOT NULL,
  subject TEXT,
  -- Resend message id.
  provider_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','sample')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digest_sends_tenant
  ON digest_sends(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_sends_subscription
  ON digest_sends(subscription_id);

ALTER TABLE digest_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE digest_sends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access digest_subscriptions" ON digest_subscriptions;
CREATE POLICY "service role full access digest_subscriptions" ON digest_subscriptions
  FOR ALL USING (true);

DROP POLICY IF EXISTS "service role full access digest_sends" ON digest_sends;
CREATE POLICY "service role full access digest_sends" ON digest_sends
  FOR ALL USING (true);

CREATE OR REPLACE FUNCTION update_digest_subs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS digest_subs_updated_at ON digest_subscriptions;
CREATE TRIGGER digest_subs_updated_at
  BEFORE UPDATE ON digest_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_digest_subs_updated_at();

COMMENT ON TABLE digest_subscriptions IS 'Per-tenant SMB owner digest subscription (PRD §6.3 S3).';
COMMENT ON TABLE digest_sends IS 'Audit + replay log for every digest send attempt.';
COMMENT ON COLUMN digest_sends.status IS 'pending=queued, sent=delivered, failed=Resend error, sample=manual preview send.';
