-- DTMF Menus table
-- Stores interactive keypad menu configurations
CREATE TABLE IF NOT EXISTS dtmf_menus (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT DEFAULT 'default' NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  menu_tree JSONB NOT NULL DEFAULT '{}',
  timeout_seconds INTEGER DEFAULT 10,
  max_retries INTEGER DEFAULT 3,
  invalid_message TEXT DEFAULT 'Invalid selection. Please try again.',
  timeout_message TEXT DEFAULT 'I didn''t hear your selection. Please press a key.',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_dtmf_menus_tenant ON dtmf_menus(tenant_id);
CREATE INDEX idx_dtmf_menus_active ON dtmf_menus(active);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_dtmf_menus_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dtmf_menus_updated_at
  BEFORE UPDATE ON dtmf_menus
  FOR EACH ROW
  EXECUTE FUNCTION update_dtmf_menus_updated_at();

-- Comments
COMMENT ON TABLE dtmf_menus IS 'DTMF (keypad) menu configurations for interactive voice response';
COMMENT ON COLUMN dtmf_menus.menu_tree IS 'JSON tree structure defining menu nodes and transitions';
COMMENT ON COLUMN dtmf_menus.timeout_seconds IS 'Seconds to wait for keypress before timeout';
COMMENT ON COLUMN dtmf_menus.max_retries IS 'Maximum retry attempts before transfer/hangup';

-- Example menu_tree structure:
-- {
--   "root": {
--     "message": "Press 1 for sales, 2 for support, 3 for billing",
--     "options": {
--       "1": { "action": "transfer", "destination": "+15551234567", "message": "Transferring to sales..." },
--       "2": { "action": "menu", "node_id": "support_submenu" },
--       "3": { "action": "collect_input", "type": "account_number", "length": 10 }
--     }
--   },
--   "support_submenu": {
--     "message": "Press 1 for technical support, 2 for account help",
--     "options": {
--       "1": { "action": "transfer", "destination": "+15551234568" },
--       "2": { "action": "transfer", "destination": "+15551234569" }
--     }
--   }
-- }
