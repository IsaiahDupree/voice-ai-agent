-- Seed reference pack #4 — Home Services (Tier A: dispatch + life-safety).
-- See INDUSTRY-PACKS.md → "Reference pack: Home Services".

UPDATE compliance_profiles
SET
  disclosure_templates = '{
    "en": "Our trip charge applies before any technician is dispatched. I will confirm it before booking."
  }'::jsonb,
  required_disclosures = '[
    "Our trip charge is acknowledged before any technician is dispatched.",
    "We never promise specific parts on the truck."
  ]'::jsonb
WHERE slug = 'home_services';

INSERT INTO industry_packs (
  slug, name, version, tier, status,
  compliance_profile_id,
  kb_schema, tool_subset,
  required_integrations, optional_integrations,
  default_voice_profile, description
) VALUES (
  'home_services',
  'Home Services Dispatcher',
  '1.0.0',
  'A',
  'published',
  (SELECT id FROM compliance_profiles WHERE slug = 'home_services'),
  '{
    "business_name":          { "type": "string",          "required": true },
    "trades":                 { "type": "string[]",        "required": true,  "description": "[\"plumbing\",\"hvac\",\"electrical\",\"roofing\",\"appliance\"]" },
    "service_area_zips":      { "type": "string[]",        "required": true,  "description": "ZIP/postal codes covered" },
    "hours":                  { "type": "weekly_schedule", "required": true },
    "after_hours_routing":    { "type": "string",          "required": true,  "enum": ["voicemail","on_call","emergency_only","decline"] },
    "trip_charge":            { "type": "string",          "required": true,  "description": "Plain-text trip charge amount + waiver rules (read verbatim)" },
    "membership_program":     { "type": "json",            "required": false, "description": "{name, annual_fee, benefits[]}" },
    "fsm_provider":           { "type": "string",          "required": false, "enum": ["servicetitan","housecall_pro","jobber","workiz","fieldedge","service_fusion"] },
    "life_safety_911_number": { "type": "phone",           "required": true,  "description": "911 fallback number" },
    "utility_emergency_number":{ "type": "phone",          "required": true,  "description": "Local utility emergency line for gas leaks etc." },
    "default_event_type_id":  { "type": "string",          "required": false }
  }'::jsonb,
  '["checkCalendar","bookAppointment","lookupContact","sendSMS","transferCall","endCall","lifeSafetyInterrupt"]'::jsonb,
  ARRAY['calendar','sms','crm']::TEXT[],
  ARRAY['servicetitan','housecall_pro','jobber','workiz','fieldedge','service_fusion','zapier']::TEXT[],
  '{
    "voice_id": "marcus_grounded",
    "temperature": 0.45,
    "warmth": 0.7,
    "speaking_rate": 1.0,
    "persona_prompt": "You are the dispatcher for a home-services company. Three priorities, in order:\n\n1. LIFE-SAFETY INTERRUPT (NON-SKIPPABLE). If the caller mentions ANY of: gas smell, smell of natural gas, suspected carbon monoxide / CO alarm, electrical fire / smoke / sparks from a panel, water actively flooding from a burst main — STOP everything else. Immediately:\n   a) call lifeSafetyInterrupt with the hazard verbatim,\n   b) tell them to leave the building / shut off the main if safe,\n   c) give them life_safety_911_number AND utility_emergency_number,\n   d) only after they confirm they''re acting do you offer to dispatch a tech for follow-up.\n   Never schedule first.\n\n2. SERVICE-AREA + TRADE TRIAGE. Confirm ZIP is in service_area_zips and the issue matches a listed trade BEFORE quoting any timing. If out-of-area, decline politely and offer to text a partner number if you have one.\n\n3. TRIP-CHARGE ACKNOWLEDGEMENT. Read trip_charge verbatim and get explicit \"yes\" before scheduling. Membership-program members may have it waived per benefits[] — check membership status via lookupContact.\n\nNever promise a specific part will be on the truck. \"The tech will diagnose and quote on-site\" is the only correct phrasing for repairs.",
    "guardrails": [
      "If gas/CO/electrical fire is mentioned, life-safety interrupt fires before any other action — non-negotiable.",
      "Never schedule out-of-area; never split a service-area ZIP across multiple techs.",
      "Trip-charge acknowledgement is a hard prerequisite to dispatch.",
      "Never promise a part is on the truck.",
      "Membership-program waivers only apply when lookupContact returns active membership."
    ]
  }'::jsonb,
  'Tier-A home services pack. Hard-coded life-safety interrupt for gas/CO/electrical-fire (not LLM-decided). ZIP + trade triage gates dispatch. Trip-charge acknowledgement is a non-skippable step. FSM-agnostic — supports ServiceTitan, Housecall Pro, Jobber, Workiz, FieldEdge, Service Fusion via the integration_map abstraction.'
) ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  version = EXCLUDED.version,
  tier = EXCLUDED.tier,
  status = EXCLUDED.status,
  compliance_profile_id = EXCLUDED.compliance_profile_id,
  kb_schema = EXCLUDED.kb_schema,
  tool_subset = EXCLUDED.tool_subset,
  required_integrations = EXCLUDED.required_integrations,
  optional_integrations = EXCLUDED.optional_integrations,
  default_voice_profile = EXCLUDED.default_voice_profile,
  description = EXCLUDED.description,
  updated_at = NOW();
