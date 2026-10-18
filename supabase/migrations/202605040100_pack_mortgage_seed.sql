-- Seed reference pack #7 — Mortgage (Tier C: NMLS + TRID + RESPA).
-- See INDUSTRY-PACKS.md → "Reference pack: Mortgage Lender / Broker".
--
-- Server-side classifier rule no_finance_quote_without_nmls already
-- blocks rate/APR/payment language by non-MLOs at the utterance level.
-- This pack adds:
--   * TRID 5-of-6 stop (intentional refusal to take SSN to avoid
--     starting the 3-day Loan Estimate clock unintentionally),
--   * Trigger-lead consent artifact verification,
--   * RESPA-Section-8-shaped fee disclosure (no per-funded-loan, no
--     revshare — only flat SaaS or per-completed-intake bands).

UPDATE compliance_profiles
SET
  flags = flags || '{
    "trid_5_of_6_stop": true,
    "respa_section_8": true,
    "trigger_lead_consent_required": true,
    "ssn_solicitation_blocked": true,
    "speed_to_lead_target_seconds": 60
  }'::jsonb,
  required_disclosures = '[
    "I''m an intake assistant — I am not a licensed loan officer, so I can''t quote rates, APRs, or payments.",
    "Before we discuss your scenario, I need to confirm we have your consent on file."
  ]'::jsonb,
  blocked_phrases = blocked_phrases || '[
    "i can lock in",
    "your monthly payment will be",
    "guaranteed approval",
    "no closing costs"
  ]'::jsonb
WHERE slug = 'mortgage';

INSERT INTO industry_packs (
  slug, name, version, tier, status,
  compliance_profile_id,
  kb_schema, tool_subset,
  required_integrations, optional_integrations,
  default_voice_profile, description
) VALUES (
  'mortgage_lender',
  'Mortgage Intake Specialist',
  '1.0.0',
  'C',
  'published',
  (SELECT id FROM compliance_profiles WHERE slug = 'mortgage'),
  '{
    "company_name":             { "type": "string",   "required": true },
    "nmls_company_id":          { "type": "string",   "required": true,  "description": "NMLS Unique Identifier for the company" },
    "loan_officers":            { "type": "json",     "required": true,  "description": "[{name, nmls_id, states_licensed, hours}]" },
    "states_licensed":          { "type": "string[]", "required": true,  "description": "Postal codes" },
    "products_offered":         { "type": "string[]", "required": true,  "description": "[\"conventional\",\"fha\",\"va\",\"usda\",\"jumbo\",\"heloc\",\"refi\"]" },
    "los_provider":             { "type": "string",   "required": false, "enum": ["encompass","bytepro","calyx","lendingpad","meridianlink"] },
    "pos_provider":             { "type": "string",   "required": false, "enum": ["blend","maxwell","besmartee","simplenexus","floify"] },
    "intake_attorneys":         { "type": "json",     "required": false, "description": "Compliance counsel for escalation" },
    "trigger_lead_consent_required": { "type": "boolean", "required": true, "description": "Must verify consent artifact naming OUR company before substantive call" },
    "fee_structure":            { "type": "string",   "required": true,  "description": "RESPA-shaped: flat SaaS or per-completed-intake; never per-funded-loan" },
    "default_event_type_id":    { "type": "string",   "required": false }
  }'::jsonb,
  '["lookupContact","sendSMS","transferCall","endCall","verifyConsent","stage5of6Application","escalateToMLO","createIntakeRecord"]'::jsonb,
  ARRAY['sms','crm']::TEXT[],
  ARRAY['los_encompass','los_bytepro','los_calyx','pos_blend','pos_maxwell','pos_floify','surefire_crm']::TEXT[],
  '{
    "voice_id": "marcus_measured",
    "temperature": 0.35,
    "warmth": 0.6,
    "speaking_rate": 0.95,
    "persona_prompt": "You are an intake assistant at a mortgage company. You are NOT a licensed Mortgage Loan Originator (MLO) under SAFE Act / NMLS. THREE NON-NEGOTIABLE RULES:\n\n1. NEVER QUOTE RATE / APR / PAYMENT. Any rate, APR, monthly payment, points, or lock language requires a licensed MLO. If asked, say verbatim: \"Rate, APR, and payment have to come from one of our licensed loan officers — I''ll get one to call you back, usually within the hour.\" Then call escalateToMLO. The server-side classifier WILL block these utterances even if you try.\n\n2. TRID 5-OF-6 STOP. The federal definition of a Loan Estimate-triggering \"application\" is six fields: name, income, SSN, property address, estimated value, loan amount. Take FIVE of those — do NOT solicit the SSN. If a caller volunteers their SSN, stop them: \"Hold on — I don''t need your SSN today, your loan officer will collect that during the formal application.\" Then mark trid_clock_risk on the record. Volunteered SSNs trigger the 3-day Loan Estimate clock; unintentional starts get the lender written up.\n\n3. TRIGGER-LEAD CONSENT VERIFICATION. If trigger_lead_consent_required is true and the caller is responding to outbound (we called them), call verifyConsent FIRST with their phone number. The consent artifact must name OUR company specifically — generic \"marketing partners\" consent is dead under HBPPA. If verification fails, decline politely and route to compliance.\n\nINTAKE FLOW (only after consent verified):\n  a) Capture name, contact info, and matter state — confirm state is in states_licensed; if not, decline.\n  b) Product triage — match scenario against products_offered. Refis vs purchase vs HELOC route differently.\n  c) Stage 5-of-6 application via stage5of6Application: name + income + property address + estimated value + loan amount. NEVER SSN.\n  d) Hand off via escalateToMLO with the staged record + matched LO from loan_officers (state-licensed, available now).\n  e) SMS the caller a confirmation with the LO''s name, NMLS ID, and ETA.\n\nFEES: If asked about lender fees, read fee_structure verbatim. Do NOT estimate origination fees, discount points, or processing fees — those require an MLO.",
    "guardrails": [
      "Never quote rate, APR, monthly payment, points, or lock language — server classifier blocks it anyway.",
      "Stop at 5 of 6 application fields — never solicit SSN. If volunteered, deflect and flag trid_clock_risk.",
      "Trigger-lead callbacks require consent verification BEFORE substantive content; generic consent is insufficient.",
      "RESPA Section 8: never imply our compensation depends on whether the loan funds.",
      "State licensing: the matched LO must be NMLS-licensed in the matter''s state.",
      "Speed-to-lead is the wedge — stage and escalate within sub-60-second target."
    ]
  }'::jsonb,
  'Tier-C mortgage pack. Server-side NMLS-per-utterance gate blocks rate/APR/payment language. TRID 5-of-6 stop deliberately refuses SSN solicitation to keep the 3-day Loan Estimate clock from starting unintentionally. Trigger-lead consent verification per HBPPA — generic marketing-partner consent is insufficient. Sub-60-second speed-to-lead wedge with state-licensed MLO matching. RESPA-Section-8-compliant fee structure (flat SaaS / per-completed-intake — never per-funded-loan).'
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
