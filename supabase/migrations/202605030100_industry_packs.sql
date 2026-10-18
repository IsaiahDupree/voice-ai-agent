-- Industry Packs — Phase 1 schema
-- See INDUSTRY-PACKS.md for architectural intent.
-- Adds three tables: compliance_profiles, industry_packs, tenant_pack_installs
-- and seeds reference compliance profiles.

-- ─── compliance_profiles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  flags JSONB NOT NULL DEFAULT '{}'::jsonb,
  disclosure_templates JSONB NOT NULL DEFAULT '{}'::jsonb,
  blocked_phrases JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_disclosures JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compliance_profiles_slug ON compliance_profiles(slug);

-- ─── industry_packs ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS industry_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  tier TEXT CHECK (tier IN ('A','B','C','D')),
  compliance_profile_id UUID REFERENCES compliance_profiles(id) ON DELETE SET NULL,
  persona_template_id TEXT,
  flow_template_id TEXT,
  kb_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  tool_subset JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_integrations TEXT[] NOT NULL DEFAULT '{}',
  optional_integrations TEXT[] NOT NULL DEFAULT '{}',
  default_voice_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_industry_packs_slug ON industry_packs(slug);
CREATE INDEX IF NOT EXISTS idx_industry_packs_status ON industry_packs(status);
CREATE INDEX IF NOT EXISTS idx_industry_packs_tier ON industry_packs(tier);

-- ─── tenant_pack_installs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tenant_pack_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pack_id UUID NOT NULL REFERENCES industry_packs(id) ON DELETE RESTRICT,
  pack_version TEXT NOT NULL,
  kb_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  integration_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','suspended','archived')),
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, pack_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_pack_installs_tenant ON tenant_pack_installs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_pack_installs_pack ON tenant_pack_installs(pack_id);
CREATE INDEX IF NOT EXISTS idx_tenant_pack_installs_status ON tenant_pack_installs(status);

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE compliance_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE industry_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_pack_installs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full access compliance_profiles" ON compliance_profiles;
CREATE POLICY "service role full access compliance_profiles" ON compliance_profiles FOR ALL USING (true);

DROP POLICY IF EXISTS "service role full access industry_packs" ON industry_packs;
CREATE POLICY "service role full access industry_packs" ON industry_packs FOR ALL USING (true);

DROP POLICY IF EXISTS "service role full access tenant_pack_installs" ON tenant_pack_installs;
CREATE POLICY "service role full access tenant_pack_installs" ON tenant_pack_installs FOR ALL USING (true);

-- ─── Seed compliance profiles ─────────────────────────────────────────
INSERT INTO compliance_profiles (slug, name, flags, required_disclosures, blocked_phrases) VALUES
  ('tcpa_baseline', 'TCPA Baseline (US Outbound)', '{
    "tcpa": true,
    "ai_voice_consent_required": true,
    "honor_dnc": true,
    "internal_dnc": true,
    "calling_window_local": true,
    "rnd_lookup_recommended": true
  }'::jsonb,
  '["This call may be recorded for quality assurance."]'::jsonb,
  '[]'::jsonb),

  ('hipaa_baseline', 'HIPAA Baseline', '{
    "hipaa": true,
    "phi_redaction": true,
    "baa_required": true,
    "zero_retention_llm": true,
    "two_party_consent_aware": true,
    "identity_verify_before_phi": true
  }'::jsonb,
  '["This line is for general scheduling. Please do not share medical details until your identity is verified."]'::jsonb,
  '["you have", "your diagnosis is", "I diagnose"]'::jsonb),

  ('veterinary', 'Veterinary (AVMA telehealth)', '{
    "no_diagnosis": true,
    "no_dosage_change": true,
    "emergency_triage": true,
    "avma_telehealth_boundaries": true
  }'::jsonb,
  '[]'::jsonb,
  '["your pet has", "give them", "increase the dose", "decrease the dose"]'::jsonb),

  ('dealership', 'Auto Dealership (TCPA + FTC pricing)', '{
    "tcpa": true,
    "ftc_pricing_claims": true,
    "ai_voice_disclosure": true,
    "approved_inventory_only": true,
    "estimated_qualifier_required": true,
    "no_finance_quotes": true
  }'::jsonb,
  '["This is an automated assistant. Calls may be recorded."]'::jsonb,
  '["guaranteed approval", "$0 down", "best price in town"]'::jsonb),

  ('restaurant', 'Restaurant (allergen safety pattern)', '{
    "allergen_flag_and_transfer": true,
    "never_confirm_allergen_safety": true,
    "multilingual": true
  }'::jsonb,
  '[]'::jsonb,
  '["that is safe for", "no allergens", "gluten free guaranteed"]'::jsonb),

  ('home_services', 'Home Services (TCPA + life-safety carve-out)', '{
    "tcpa": true,
    "dispatch_fee_acknowledgement": true,
    "life_safety_interrupt": true,
    "no_parts_promise": true
  }'::jsonb,
  '["Our trip charge is acknowledged before any technician is dispatched."]'::jsonb,
  '["we have that part on the truck"]'::jsonb),

  ('legal_intake', 'Legal Intake (UPL + ABA 5.5/5.3)', '{
    "upl_classifier": true,
    "no_case_evaluation": true,
    "conflict_check_required": true,
    "no_fee_split_with_nonlawyers": true,
    "two_party_consent_aware": true
  }'::jsonb,
  '[]'::jsonb,
  '["you have a strong case", "your case is worth", "the statute of limitations is"]'::jsonb),

  ('insurance', 'Insurance (TCPA + RND + CMS Medicare)', '{
    "tcpa": true,
    "rnd_pre_outbound": true,
    "cms_medicare_tpmo": true,
    "soa_before_substance": true,
    "carrier_appointment_gate": true
  }'::jsonb,
  '["We do not offer every plan available in your area."]'::jsonb,
  '[]'::jsonb),

  ('mortgage', 'Mortgage (NMLS/SAFE + TRID + RESPA)', '{
    "nmls_per_utterance_gate": true,
    "trid_5_of_6_stop": true,
    "respa_section_8": true,
    "trigger_lead_consent_required": true
  }'::jsonb,
  '[]'::jsonb,
  '["your rate is", "your apr is", "your payment will be"]'::jsonb),

  ('childcare', 'Childcare (COPPA + mandatory reporter)', '{
    "coppa": true,
    "ferpa": false,
    "mandatory_reporter": true,
    "authorized_pickup_voice_immutable": true,
    "state_ratio_capacity": true
  }'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb)
ON CONFLICT (slug) DO NOTHING;
