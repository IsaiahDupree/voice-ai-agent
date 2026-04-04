-- F0256: Dialer warm-up
-- F0257: Predictive dial ratio
-- Dialer state tracking table

CREATE TABLE IF NOT EXISTS dialer_state (
  campaign_id TEXT PRIMARY KEY,
  current_concurrency INTEGER NOT NULL DEFAULT 1,
  warmup_started_at TIMESTAMP WITH TIME ZONE,
  warmup_config JSONB, -- DialerWarmupConfig
  predictive_config JSONB, -- PredictiveDialConfig
  stats JSONB DEFAULT '{"total_calls": 0, "abandoned_calls": 0, "abandon_rate": 0}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dialer_state_campaign_id ON dialer_state(campaign_id);

-- Update timestamp trigger
CREATE TRIGGER update_dialer_state_updated_at
  BEFORE UPDATE ON dialer_state
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE dialer_state IS 'F0256/F0257: Tracks dialer warm-up and predictive dialing state per campaign';
COMMENT ON COLUMN dialer_state.current_concurrency IS 'Current max simultaneous calls (increases during warm-up)';
COMMENT ON COLUMN dialer_state.warmup_config IS 'Warm-up configuration: initial/max concurrency, ramp duration, step size';
COMMENT ON COLUMN dialer_state.predictive_config IS 'Predictive dialing config: dial ratio, max abandon rate, auto-adjust';
COMMENT ON COLUMN dialer_state.stats IS 'Campaign stats: total calls, abandoned calls, abandon rate %';
