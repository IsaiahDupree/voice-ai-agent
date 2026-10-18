-- Pack install extensions: assistant materialization + version history
ALTER TABLE tenant_pack_installs
  ADD COLUMN IF NOT EXISTS assistant_id TEXT,
  ADD COLUMN IF NOT EXISTS previous_pack_version TEXT,
  ADD COLUMN IF NOT EXISTS upgrade_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tenant_pack_installs_assistant
  ON tenant_pack_installs(assistant_id);
