-- MCP Registry table for registering external MCP servers
-- Feature 146: Store MCP server connections that Vapi can call via bridge

CREATE TABLE IF NOT EXISTS mcp_registry (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  server_name TEXT NOT NULL,
  server_url TEXT NOT NULL,
  auth_type TEXT DEFAULT 'none' CHECK (auth_type IN ('none', 'api_key', 'bearer_token', 'basic')),
  auth_config JSONB DEFAULT '{}',
  enabled_tools TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'error')),
  last_health_check_at TIMESTAMPTZ,
  health_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, server_name)
);

-- Indexes
CREATE INDEX idx_mcp_registry_tenant_id ON mcp_registry(tenant_id);
CREATE INDEX idx_mcp_registry_server_name ON mcp_registry(server_name);
CREATE INDEX idx_mcp_registry_status ON mcp_registry(status);

-- RLS policies
ALTER TABLE mcp_registry ENABLE ROW LEVEL SECURITY;

-- Users can view their tenant's MCP servers
CREATE POLICY "Users can view their tenant MCP servers" ON mcp_registry
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Users can create MCP servers for their tenant
CREATE POLICY "Users can create MCP servers for their tenant" ON mcp_registry
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Users can update their tenant's MCP servers
CREATE POLICY "Users can update their tenant MCP servers" ON mcp_registry
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Users can delete their tenant's MCP servers
CREATE POLICY "Users can delete their tenant MCP servers" ON mcp_registry
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to mcp_registry" ON mcp_registry
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_mcp_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER mcp_registry_updated_at
  BEFORE UPDATE ON mcp_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_mcp_registry_updated_at();

-- Comments
COMMENT ON TABLE mcp_registry IS 'Registry of MCP servers that can be called via the MCP bridge';
COMMENT ON COLUMN mcp_registry.server_name IS 'Unique name for this MCP server (e.g., supabase, calendar, crm)';
COMMENT ON COLUMN mcp_registry.server_url IS 'Base URL or connection string for the MCP server';
COMMENT ON COLUMN mcp_registry.auth_type IS 'Authentication method: none, api_key, bearer_token, or basic';
COMMENT ON COLUMN mcp_registry.auth_config IS 'Authentication credentials (encrypted in practice)';
COMMENT ON COLUMN mcp_registry.enabled_tools IS 'Whitelist of tool names that can be called via this server';
COMMENT ON COLUMN mcp_registry.status IS 'Server status: active, disabled, or error';
