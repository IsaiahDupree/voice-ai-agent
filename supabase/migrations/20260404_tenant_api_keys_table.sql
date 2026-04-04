-- Tenant API Keys table for per-tenant API authentication

CREATE TABLE IF NOT EXISTS tenant_api_keys (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_tenant_api_keys_tenant_id ON tenant_api_keys(tenant_id);
CREATE INDEX idx_tenant_api_keys_key_hash ON tenant_api_keys(key_hash);
CREATE INDEX idx_tenant_api_keys_status ON tenant_api_keys(status);

-- RLS policies
ALTER TABLE tenant_api_keys ENABLE ROW LEVEL SECURITY;

-- Users can view their tenant's API keys
CREATE POLICY "Users can view their tenant API keys" ON tenant_api_keys
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Users can create API keys for their tenant
CREATE POLICY "Users can create API keys for their tenant" ON tenant_api_keys
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Users can revoke their tenant's API keys
CREATE POLICY "Users can update their tenant API keys" ON tenant_api_keys
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to tenant_api_keys" ON tenant_api_keys
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Comments
COMMENT ON TABLE tenant_api_keys IS 'API keys for tenant-scoped authentication';
COMMENT ON COLUMN tenant_api_keys.key_hash IS 'SHA-256 hash of the API key (never store plaintext)';
COMMENT ON COLUMN tenant_api_keys.scopes IS 'Permission scopes for this API key (e.g., calls:read, contacts:write)';
COMMENT ON COLUMN tenant_api_keys.status IS 'active or revoked';
