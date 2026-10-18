-- Per-tenant integration credentials vault.
-- Stored as encrypted bytes; the app layer (lib/packs/credentials.ts)
-- handles AES-256-GCM seal/open. We store the IV+tag inline as
-- base64-encoded text so this works on any Postgres without pgcrypto.

ALTER TABLE tenant_pack_installs
  ADD COLUMN IF NOT EXISTS integration_credentials_enc TEXT,
  ADD COLUMN IF NOT EXISTS integration_credentials_kid TEXT;

COMMENT ON COLUMN tenant_pack_installs.integration_credentials_enc IS
  'base64(iv|tag|ciphertext) of JSON {provider_slug: {key: value}}; AES-256-GCM. NEVER returned to client.';
COMMENT ON COLUMN tenant_pack_installs.integration_credentials_kid IS
  'Active key id from PACK_CREDENTIALS_KEYS for rotation support.';
