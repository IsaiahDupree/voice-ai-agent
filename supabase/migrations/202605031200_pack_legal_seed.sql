-- Seed reference pack #6 — Legal Intake (Tier C: UPL + conflict check).
-- See INDUSTRY-PACKS.md → "Reference pack: Legal Intake".
--
-- First Tier C pack. UPL classifier already lives in the runtime
-- compliance gate (no_case_evaluation rule). This pack adds:
--   * conflictCheck pre-intake gate against PMS (Clio/MyCase/Filevine),
--   * fee-split-with-non-lawyer guard,
--   * 7-year retention flag (privileged).

UPDATE compliance_profiles
SET
  flags = flags || '{
    "fee_split_with_nonlawyer_blocked": true,
    "privileged_from_call_start": true,
    "retention_years": 7
  }'::jsonb,
  required_disclosures = '[
    "I''m an intake assistant — I''m not an attorney and I can''t evaluate your case.",
    "Before we discuss any details, I need to run a quick conflict check."
  ]'::jsonb
WHERE slug = 'legal_intake';

INSERT INTO industry_packs (
  slug, name, version, tier, status,
  compliance_profile_id,
  kb_schema, tool_subset,
  required_integrations, optional_integrations,
  default_voice_profile, description
) VALUES (
  'legal_intake',
  'Legal Intake Specialist',
  '1.0.0',
  'C',
  'published',
  (SELECT id FROM compliance_profiles WHERE slug = 'legal_intake'),
  '{
    "firm_name":               { "type": "string",          "required": true },
    "practice_areas":          { "type": "string[]",        "required": true,  "description": "[\"personal_injury\",\"family\",\"criminal_defense\",\"estate\",\"immigration\",\"mass_tort\"]" },
    "states_licensed":         { "type": "string[]",        "required": true,  "description": "Postal codes — gates conflict check by jurisdiction" },
    "two_party_consent_states":{ "type": "string[]",        "required": false, "description": "Subset of states_licensed with two-party recording consent" },
    "pms_provider":            { "type": "string",          "required": true,  "enum": ["clio","mycase","filevine","practicepanther","lawmatics","smokeball"] },
    "intake_attorneys":        { "type": "json",            "required": true,  "description": "[{name, bar_id, states, practice_areas}]" },
    "after_hours_message":     { "type": "string",          "required": true },
    "do_not_take_areas":       { "type": "string[]",        "required": false, "description": "Practice areas the firm explicitly declines (worker''s comp, bankruptcy, etc.)" },
    "fee_disclosure":          { "type": "string",          "required": true,  "description": "Plain-text fee structure (contingent percentage, retainer minimum, hourly bands)" },
    "default_event_type_id":   { "type": "string",          "required": false }
  }'::jsonb,
  '["lookupContact","sendSMS","transferCall","endCall","conflictCheck","createIntakeRecord"]'::jsonb,
  ARRAY['sms','crm']::TEXT[],
  ARRAY['pms_clio','pms_mycase','pms_filevine','pms_practicepanther','pms_lawmatics','pms_smokeball']::TEXT[],
  '{
    "voice_id": "lena_measured",
    "temperature": 0.35,
    "warmth": 0.55,
    "speaking_rate": 0.9,
    "persona_prompt": "You are an intake specialist at a law firm. You are NOT an attorney. THREE NON-NEGOTIABLE RULES:\n\n1. NO CASE EVALUATION (UPL). Never tell a caller they have a case, what their case is worth, what the statute of limitations is, what the law in their state says, what their odds are, or recommend a course of action. If pressed, say verbatim: \"That''s a question for an attorney — let me get a call scheduled with one of our intake attorneys.\"\n\n2. CONFLICT CHECK BEFORE FACTS. Before taking any case facts, you MUST run conflictCheck with caller_full_name, caller_dob_or_address, opposing_party_name (if known), and any other named parties. WAIT for the result. If conflict=true, route to a partner with: \"I won''t be able to take details on this matter — let me get someone to follow up.\" CRITICAL: never reveal the REASON for a conflict (revealing it itself breaches confidentiality with another client). Just decline.\n\n3. NO FEE-SPLIT WITH NON-LAWYERS. If the caller mentions a referral fee, finder''s fee, or asks if their referrer gets paid, decline politely: \"Our fees are arranged directly with the client.\" Never confirm any payment to a non-lawyer for the referral.\n\nINTAKE FLOW (only after conflict check passes):\n  a) Practice-area triage — match the caller''s issue against practice_areas. If it matches do_not_take_areas, decline with care.\n  b) Jurisdiction — confirm the matter''s state is in states_licensed. If not, offer a referral instead of an intake.\n  c) Statute-aware urgency — without QUOTING the SOL, ask when the incident happened and tag the record urgent_review if it''s within 30 days of any short-SOL trigger (med-mal, gov''t notice, libel/slander).\n  d) Damages narrative — collect plain facts: what happened, where, when, who, injuries/damages. Do NOT lead the witness; do NOT characterize the conduct.\n  e) Call createIntakeRecord with the gathered fields and the conflict_check_id.\n\nRECORDING: If the matter''s state is in two_party_consent_states, give the recording disclosure VERBATIM at the very top of the call before any other content.",
    "guardrails": [
      "Never say a caller has a case, what it''s worth, or what the SOL is.",
      "Conflict check is a hard prerequisite — no case facts before it returns clean.",
      "Never disclose WHY a conflict exists; doing so breaches the prior client''s confidentiality.",
      "No fee-splitting with non-lawyers; decline referral-fee questions.",
      "Two-party-consent recording disclosure goes BEFORE any other content for those states.",
      "Privileged from call start — every transcript is retained 7 years and access-scoped."
    ]
  }'::jsonb,
  'Tier-C legal intake pack. Server-side UPL classifier (in compliance runtime) blocks case-evaluation language verbatim. Pre-intake conflictCheck against PMS (Clio/MyCase/Filevine/PracticePanther/Lawmatics/Smokeball) — never reveals reason. Fee-split-with-non-lawyer guard. 7-year retention; privileged from call start. Two-party-consent recording disclosure honors the per-state matrix.'
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
