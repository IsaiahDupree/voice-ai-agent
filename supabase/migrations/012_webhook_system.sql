-- F0141: Inbound webhook trigger
-- Webhook configuration and logging tables

-- Webhook configurations
CREATE TABLE IF NOT EXISTS webhook_configs (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'call.started',
    'call.ended',
    'call.transferred',
    'transcript.received',
    'booking.created',
    'sms.sent'
  )),
  secret TEXT, -- Optional HMAC secret for signature
  enabled BOOLEAN DEFAULT true,
  headers JSONB DEFAULT '{}', -- Custom headers
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_configs_event_type ON webhook_configs(event_type);
CREATE INDEX idx_webhook_configs_enabled ON webhook_configs(enabled) WHERE enabled = true;

-- Webhook execution logs
CREATE TABLE IF NOT EXISTS webhook_logs (
  id BIGSERIAL PRIMARY KEY,
  webhook_id BIGINT REFERENCES webhook_configs(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  call_id TEXT,
  success BOOLEAN NOT NULL,
  status_code INTEGER,
  error TEXT,
  attempts INTEGER DEFAULT 1,
  triggered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_call_id ON webhook_logs(call_id);
CREATE INDEX idx_webhook_logs_triggered_at ON webhook_logs(triggered_at DESC);
CREATE INDEX idx_webhook_logs_success ON webhook_logs(success);

-- Enable RLS
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for service role)
CREATE POLICY "webhook_configs_service_role_policy" ON webhook_configs
  FOR ALL USING (true);

CREATE POLICY "webhook_logs_service_role_policy" ON webhook_logs
  FOR ALL USING (true);

-- Add helpful comments
COMMENT ON TABLE webhook_configs IS 'F0141: External webhook configurations for call events';
COMMENT ON TABLE webhook_logs IS 'F0141: Webhook execution history and debugging logs';
COMMENT ON COLUMN webhook_configs.secret IS 'Optional HMAC-SHA256 secret for webhook signature verification';
COMMENT ON COLUMN webhook_logs.attempts IS 'Number of delivery attempts (max 3)';
