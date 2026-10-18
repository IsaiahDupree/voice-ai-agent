-- Agencies layer — Sprint 1 (PRD §6).
--
-- Adds the agency-tier above tenants so an agency owner can manage many
-- SMB clients (each = one tenant) from a single account. Tenants gain an
-- optional agency_id; tenants without one are direct (single-org) installs
-- and continue to work exactly as before.
--
-- Three tables:
--   agencies            — the agency org (one row per agency)
--   agency_users        — user ↔ agency membership with a role
--   tenants.agency_id   — soft FK so we never orphan a tenant
--
-- RLS is on but permissive in this migration; the route-level RBAC layer
-- (lib/rbac.ts + tenant-router) is the authoritative gate. We add the
-- structure here so subsequent migrations can tighten policies without
-- a schema change.

-- ─── agencies ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  -- Branding for white-labeled client reports.
  logo_url TEXT,
  primary_color TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  -- Stripe linkage for self-serve billing in S4.
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter','growth','scale','enterprise')),
  -- Entitlement caps; enforced at provision-client API.
  max_clients INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','archived')),
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agencies_slug ON agencies(slug);
CREATE INDEX IF NOT EXISTS idx_agencies_status ON agencies(status);
CREATE INDEX IF NOT EXISTS idx_agencies_stripe_customer ON agencies(stripe_customer_id);

-- ─── agency_users ────────────────────────────────────────────────────
-- A user can belong to one agency at a time at v1.0. (Multi-agency
-- staffing is a v1.x consideration — see PRD §9.)
CREATE TABLE IF NOT EXISTS agency_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator' CHECK (role IN ('owner','admin','operator','readonly')),
  invited_email TEXT,
  invited_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agency_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agency_users_agency ON agency_users(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_users_user ON agency_users(user_id);

-- ─── tenants.agency_id ───────────────────────────────────────────────
-- Tenants without an agency_id remain valid; this keeps every existing
-- single-tenant install untouched.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_agency ON tenants(agency_id);

-- Optional display name the agency uses for the SMB client (e.g. the
-- agency calls them "Smith Roofing", their legal name might differ).
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS provisioned_by TEXT;

-- ─── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE agency_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access agencies" ON agencies;
CREATE POLICY "service role full access agencies" ON agencies FOR ALL USING (true);

DROP POLICY IF EXISTS "service role full access agency_users" ON agency_users;
CREATE POLICY "service role full access agency_users" ON agency_users FOR ALL USING (true);

-- ─── updated_at trigger ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_agencies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agencies_updated_at ON agencies;
CREATE TRIGGER agencies_updated_at
  BEFORE UPDATE ON agencies
  FOR EACH ROW
  EXECUTE FUNCTION update_agencies_updated_at();

-- ─── seed default agency for existing tenants (optional) ─────────────
-- The single-tenant path keeps working without an agency. The default
-- agency is for an install that wants the agency dashboard immediately
-- against the existing default tenant.
INSERT INTO agencies (id, slug, name, plan, max_clients, status)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'default-agency',
  'Default Agency',
  'starter',
  5,
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- Comments
COMMENT ON TABLE agencies IS 'Agency owners (buyers). One agency owns many SMB tenants.';
COMMENT ON TABLE agency_users IS 'Users belonging to an agency, with a role.';
COMMENT ON COLUMN tenants.agency_id IS 'Optional FK to agencies — null for direct single-tenant installs.';
COMMENT ON COLUMN tenants.display_name IS 'Agency-facing display name for the SMB client.';
