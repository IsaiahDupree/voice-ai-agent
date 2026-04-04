-- Add tenant_id to major tables and enable RLS policies for multi-tenant isolation

-- Step 1: Add tenant_id columns to tables that don't have them yet
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default' REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE contacts
ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default' REFERENCES tenants(id) ON DELETE CASCADE;

ALTER TABLE voice_agent_calls
ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'default' REFERENCES tenants(id) ON DELETE CASCADE;

-- Step 2: Create indexes for tenant_id columns on all relevant tables
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_voice_agent_calls_tenant_id ON voice_agent_calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_caller_memory_tenant_id ON caller_memory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_documents_tenant_id ON kb_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_kb_embeddings_tenant_id ON kb_embeddings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_live_transcripts_tenant_id ON live_transcripts(tenant_id);

-- Step 3: Enable Row Level Security on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE caller_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_transcripts ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for tenants table
CREATE POLICY "Users can view their own tenant" ON tenants
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Service role has full access to tenants" ON tenants
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 5: Create RLS policies for tenant_configs table
CREATE POLICY "Users can view their tenant config" ON tenant_configs
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Service role has full access to tenant_configs" ON tenant_configs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 6: Create RLS policies for campaigns table
CREATE POLICY "Users can view campaigns in their tenant" ON campaigns
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Users can insert campaigns in their tenant" ON campaigns
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Users can update campaigns in their tenant" ON campaigns
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Service role has full access to campaigns" ON campaigns
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 7: Create RLS policies for contacts table
CREATE POLICY "Users can view contacts in their tenant" ON contacts
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Users can insert contacts in their tenant" ON contacts
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Users can update contacts in their tenant" ON contacts
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Service role has full access to contacts" ON contacts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 8: Create RLS policies for voice_agent_calls table
CREATE POLICY "Users can view calls in their tenant" ON voice_agent_calls
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Users can insert calls in their tenant" ON voice_agent_calls
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Service role has full access to voice_agent_calls" ON voice_agent_calls
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 9: Create RLS policies for caller_memory table
CREATE POLICY "Users can view caller memory in their tenant" ON caller_memory
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Users can insert caller memory in their tenant" ON caller_memory
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Users can update caller memory in their tenant" ON caller_memory
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Service role has full access to caller_memory" ON caller_memory
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 10: Create RLS policies for kb_documents table
CREATE POLICY "Users can view KB documents in their tenant" ON kb_documents
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Users can insert KB documents in their tenant" ON kb_documents
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Users can delete KB documents in their tenant" ON kb_documents
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Service role has full access to kb_documents" ON kb_documents
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 11: Create RLS policies for kb_embeddings table
CREATE POLICY "Users can view KB embeddings in their tenant" ON kb_embeddings
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Service role has full access to kb_embeddings" ON kb_embeddings
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 12: Create RLS policies for live_transcripts table
CREATE POLICY "Users can view live transcripts in their tenant" ON live_transcripts
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Users can insert live transcripts in their tenant" ON live_transcripts
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

CREATE POLICY "Service role has full access to live_transcripts" ON live_transcripts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Comments
COMMENT ON POLICY "Service role has full access to tenants" ON tenants IS 'Service role bypasses RLS for backend operations';
COMMENT ON POLICY "Service role has full access to campaigns" ON campaigns IS 'Service role bypasses RLS for backend operations';
COMMENT ON POLICY "Service role has full access to contacts" ON contacts IS 'Service role bypasses RLS for backend operations';
COMMENT ON POLICY "Service role has full access to voice_agent_calls" ON voice_agent_calls IS 'Service role bypasses RLS for backend operations';
COMMENT ON POLICY "Service role has full access to caller_memory" ON caller_memory IS 'Service role bypasses RLS for backend operations';
COMMENT ON POLICY "Service role has full access to kb_documents" ON kb_documents IS 'Service role bypasses RLS for backend operations';
COMMENT ON POLICY "Service role has full access to kb_embeddings" ON kb_embeddings IS 'Service role bypasses RLS for backend operations';
COMMENT ON POLICY "Service role has full access to live_transcripts" ON live_transcripts IS 'Service role bypasses RLS for backend operations';
