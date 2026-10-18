-- Tenant Config table with kb_namespace for multi-tenant KB isolation
-- Each tenant gets their own knowledge base namespace

-- First, create the base tenants table if it doesn't exist
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  phone_numbers TEXT[] DEFAULT '{}',
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant configurations with kb_namespace
CREATE TABLE IF NOT EXISTS tenant_configs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id TEXT UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  kb_namespace TEXT NOT NULL DEFAULT 'default',
  assistant_id TEXT,
  persona_name TEXT,
  voice_id TEXT,
  system_prompt TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  business_hours JSONB DEFAULT '{"monday": {"open": "09:00", "close": "17:00"}, "tuesday": {"open": "09:00", "close": "17:00"}, "wednesday": {"open": "09:00", "close": "17:00"}, "thursday": {"open": "09:00", "close": "17:00"}, "friday": {"open": "09:00", "close": "17:00"}}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist (table may have been pre-created with fewer columns)
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone_numbers TEXT[] DEFAULT '{}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';

-- Add CHECK constraint for plan if it doesn't exist (may fail silently if already exists)
DO $$ BEGIN
  ALTER TABLE tenants ADD CONSTRAINT tenants_plan_check CHECK (plan IN ('free', 'starter', 'pro', 'enterprise'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenant_configs_tenant_id ON tenant_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_configs_kb_namespace ON tenant_configs(kb_namespace);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_tenants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenants_updated_at ON tenants;
CREATE TRIGGER tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenants_updated_at();

CREATE OR REPLACE FUNCTION update_tenant_configs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_configs_updated_at ON tenant_configs;
CREATE TRIGGER tenant_configs_updated_at
  BEFORE UPDATE ON tenant_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_configs_updated_at();

-- Insert default tenant
INSERT INTO tenants (id, name, slug, plan)
VALUES ('default', 'Default Tenant', 'default', 'pro')
ON CONFLICT (id) DO NOTHING;

-- Insert default tenant config
INSERT INTO tenant_configs (tenant_id, kb_namespace)
VALUES ('default', 'default')
ON CONFLICT (tenant_id) DO NOTHING;

-- Comments
COMMENT ON TABLE tenants IS 'Multi-tenant configuration - each client gets isolated data';
COMMENT ON TABLE tenant_configs IS 'Per-tenant settings including KB namespace for isolation';
COMMENT ON COLUMN tenant_configs.kb_namespace IS 'Namespace for isolating this tenant knowledge base data';
