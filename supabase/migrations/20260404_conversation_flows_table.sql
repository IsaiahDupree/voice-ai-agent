-- Feature 166: Conversation Flows table for visual flow builder
-- Stores ReactFlow graph data (nodes + edges) for conversation state machines

CREATE TABLE IF NOT EXISTS conversation_flows (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  version INTEGER DEFAULT 1,
  vapi_assistant_id TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(tenant_id, name)
);

-- Indexes
CREATE INDEX idx_conversation_flows_tenant_id ON conversation_flows(tenant_id);
CREATE INDEX idx_conversation_flows_name ON conversation_flows(tenant_id, name);
CREATE INDEX idx_conversation_flows_vapi_assistant_id ON conversation_flows(vapi_assistant_id) WHERE vapi_assistant_id IS NOT NULL;
CREATE INDEX idx_conversation_flows_is_active ON conversation_flows(tenant_id, is_active) WHERE is_active = true;

-- RLS policies
ALTER TABLE conversation_flows ENABLE ROW LEVEL SECURITY;

-- Users can view their tenant's flows
CREATE POLICY "Users can view their tenant flows" ON conversation_flows
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Users can create flows for their tenant
CREATE POLICY "Users can create flows for their tenant" ON conversation_flows
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Users can update their tenant's flows
CREATE POLICY "Users can update their tenant flows" ON conversation_flows
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Users can delete their tenant's flows
CREATE POLICY "Users can delete their tenant flows" ON conversation_flows
  FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND
    tenant_id = COALESCE(
      auth.jwt() -> 'app_metadata' ->> 'tenant_id',
      'default'
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to conversation_flows" ON conversation_flows
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_conversation_flows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_flows_updated_at
  BEFORE UPDATE ON conversation_flows
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_flows_updated_at();

-- Version increment trigger (when nodes or edges change)
CREATE OR REPLACE FUNCTION increment_conversation_flow_version()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.nodes IS DISTINCT FROM OLD.nodes OR NEW.edges IS DISTINCT FROM OLD.edges THEN
    NEW.version = OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER conversation_flows_version_increment
  BEFORE UPDATE ON conversation_flows
  FOR EACH ROW
  EXECUTE FUNCTION increment_conversation_flow_version();

-- Comments
COMMENT ON TABLE conversation_flows IS 'Visual conversation state machines built with ReactFlow';
COMMENT ON COLUMN conversation_flows.name IS 'Unique name for this conversation flow';
COMMENT ON COLUMN conversation_flows.nodes IS 'ReactFlow nodes array (SpeakNode, ListenNode, ConditionNode, ToolNode, etc.)';
COMMENT ON COLUMN conversation_flows.edges IS 'ReactFlow edges array (connections between nodes)';
COMMENT ON COLUMN conversation_flows.version IS 'Auto-incremented version number when nodes/edges change';
COMMENT ON COLUMN conversation_flows.vapi_assistant_id IS 'Vapi assistant ID created from this flow export';
COMMENT ON COLUMN conversation_flows.is_active IS 'Whether this flow is currently deployed and active';
