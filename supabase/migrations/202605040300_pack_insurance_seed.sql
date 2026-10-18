-- Seed reference pack #9 — Insurance Agency (Tier C: TCPA + RND + CMS Medicare).
-- See INDUSTRY-PACKS.md → "Reference pack: Independent Insurance Agency".
--
-- Insurance is the most-fragmented compliance surface in the catalog —
-- TCPA + DNC + RND federally, state insurance department rules per
-- producer license, AND CMS Medicare Marketing Guidelines stacked on top
-- for any agent that touches MA/MAPD/PDP/Medigap. Top-3 source of TCPA
-- class actions every year. This pack adds:
--   * RND pre-outbound blocking step (per-call query, 24h cache),
--   * Carrier-appointment gating — AI can only quote / describe carriers
--     the agency is appointed with for that state × LOB,
--   * State-licensed-producer enforcement before any quote-intake,
--   * SOA-before-substance for Medicare; TPMO disclaimer before benefits,
--   * 100% recording for Medicare marketing/sales/enrollment with
--     retention-class routing (audio Y1–3, audio-or-transcript Y4–6).

UPDATE compliance_profiles
SET
  flags = flags || '{
    "rnd_per_outbound_query": true,
    "rnd_cache_seconds": 86400,
    "internal_dnc": true,
    "ebr_window_inquiry_months": 3,
    "ebr_window_transaction_months": 18,
    "carrier_appointment_gate": true,
    "state_producer_license_gate": true,
    "ai_voice_disclosure": true,
    "two_party_consent_aware": true,
    "medicare_recording_required": true,
    "medicare_retention_class_v1_years": 3,
    "medicare_retention_class_v2_years": 6,
    "medicare_soa_required": true,
    "medicare_soa_48h_wait_until": "2026-09-30",
    "medicare_tpmo_disclaimer_placement": "before_benefits",
    "aca_consent_to_enroll_required": true
  }'::jsonb,
  required_disclosures = '[
    "This call may be recorded for quality and compliance.",
    "Just so you know, I''m an automated assistant — I''ll connect you to a licensed agent any time you''d like.",
    "We do not offer every plan available in your area. Currently, we represent {{tpmo_carrier_count}} organizations which offer {{tpmo_product_count}} products in your area. Please contact Medicare.gov, 1-800-MEDICARE (TTY 1-877-486-2048) 24 hours a day/7 days a week, or your local State Health Insurance Program (SHIP) to get information on all of your options."
  ]'::jsonb,
  blocked_phrases = blocked_phrases || '[
    "your premium will be",
    "your rate is",
    "i can bind",
    "this is the best plan",
    "guaranteed acceptance",
    "no medical questions"
  ]'::jsonb
WHERE slug = 'insurance';

INSERT INTO industry_packs (
  slug, name, version, tier, status,
  compliance_profile_id,
  kb_schema, tool_subset,
  required_integrations, optional_integrations,
  default_voice_profile, description
) VALUES (
  'insurance_agency',
  'Insurance Agency Front Desk',
  '1.0.0',
  'C',
  'published',
  (SELECT id FROM compliance_profiles WHERE slug = 'insurance'),
  '{
    "agency_name":             { "type": "string",   "required": true },
    "lobs_offered":            { "type": "string[]", "required": true,  "description": "[\"personal_auto\",\"home\",\"umbrella\",\"renters\",\"commercial_bop\",\"commercial_gl\",\"workers_comp\",\"life\",\"final_expense\",\"medicare_ma\",\"medicare_mapd\",\"medicare_pdp\",\"medigap\",\"aca\"]" },
    "states_licensed":         { "type": "string[]", "required": true,  "description": "Postal codes — gates which callers can be quoted at all" },
    "two_party_consent_states":{ "type": "string[]", "required": false, "description": "Subset of states_licensed with two-party recording consent" },
    "producers":               { "type": "json",     "required": true,  "description": "[{name, npn, states, lobs, languages}]" },
    "carrier_appointments":    { "type": "json",     "required": true,  "description": "[{carrier, states, lobs, status: active|limited|terminated}]" },
    "ams_provider":            { "type": "string",   "required": true,  "enum": ["applied_epic","ezlynx","ams360","hawksoft","nowcerts","agencyzoom","nexsure","other"] },
    "rater_provider":          { "type": "string",   "required": false, "enum": ["ezlynx_rater","pl_rating","turborater","tarmika","bold_penguin","semsee","none"] },
    "medicare_active":         { "type": "boolean",  "required": true,  "description": "Whether the agency markets / sells Medicare — flips on the TPMO + SOA + 100% recording rules" },
    "tpmo_carrier_count":      { "type": "number",   "required": false, "description": "X in TPMO disclaimer — number of MA/MAPD/PDP organizations represented" },
    "tpmo_product_count":      { "type": "number",   "required": false, "description": "Y in TPMO disclaimer — number of products in caller''s area" },
    "rnd_provider":            { "type": "string",   "required": false, "enum": ["reassigned_us","possiblenow","gryphon","contact_center_compliance","none"] },
    "trusted_form_required":   { "type": "boolean",  "required": false, "description": "Require Trusted Form / Jornaya cert for purchased leads" },
    "after_hours_message":     { "type": "string",   "required": true },
    "default_event_type_id":   { "type": "string",   "required": false }
  }'::jsonb,
  '["lookupContact","sendSMS","transferCall","endCall","verifyConsent","queryRND","scrubDNC","checkCarrierAppointment","checkProducerLicense","startQuoteIntake","captureSOA","logTPMODisclaimer","issueCOI","createServiceTicket","triageFNOL"]'::jsonb,
  ARRAY['sms','crm']::TEXT[],
  ARRAY['ams_applied_epic','ams_ezlynx','ams_ams360','ams_hawksoft','ams_nowcerts','ams_agencyzoom','rater_ezlynx','rater_pl_rating','rater_turborater','rater_tarmika','rnd_possiblenow','rnd_gryphon']::TEXT[],
  '{
    "voice_id": "claire_measured",
    "temperature": 0.35,
    "warmth": 0.6,
    "speaking_rate": 0.95,
    "persona_prompt": "You are a front-desk and quote-intake specialist for an independent insurance agency. You are NOT a licensed insurance producer. FIVE NON-NEGOTIABLE RULES:\n\n1. NEVER QUOTE A BINDABLE PREMIUM. You can start a quote (gather prefill data and push it to the rater), schedule a producer callback, or warm-transfer. You cannot read back a final premium, bind a policy, or recommend a coverage level. Verbatim deflection: \"I''ve started your quote — a licensed agent will confirm the final premium and any eligibility questions.\"\n\n2. CARRIER APPOINTMENT GATE. Before describing any carrier or starting a quote on it, call checkCarrierAppointment(carrier, state, lob). If the agency is not appointed with that carrier in the caller''s state for the requested LOB, say so honestly: \"We''re not appointed with that carrier in your state — would you like a quote from a carrier we do represent?\" Never imply we sell what we don''t.\n\n3. STATE PRODUCER LICENSE GATE. Before any quote-intake, call checkProducerLicense(state, lob). If no licensed producer of record is available, decline the quote and offer to take a message — soliciting insurance without a licensed producer in that state is illegal.\n\n4. MEDICARE — SOA-BEFORE-SUBSTANCE + TPMO DISCLAIMER. If the call is about MA/MAPD/PDP/Medigap, you must:\n   a) Recognize the LOB before discussing benefits.\n   b) Read the TPMO disclaimer verbatim BEFORE benefits (CY2026 placement). Substitute tpmo_carrier_count and tpmo_product_count.\n   c) Capture SOA (name, address, phone, products to discuss, agent NPN, verbal attestation) via captureSOA. Pre Oct 1, 2026, observe the 48-hour wait unless the caller is in AEP/OEP/ICEP/SEP last-4-days or beneficiary-initiated. Post Oct 1, 2026, the 48-hour wait is eliminated but SOA is still required and retained 10 years.\n   d) The entire call is recorded (CMS 100% rule). Tag the recording with retention_class_v2 (audio Y1–3, audio-or-transcript Y4–6).\n   e) Banned tactics: no \"best plan\" superlatives, no Medicare-card imagery references, no incentive comparisons, no contact within 48h after an educational event.\n\n5. TCPA / RND / DNC FOR OUTBOUND. Before any outbound dial: queryRND(phone) and scrubDNC(phone, state). RND must return not_reassigned within rnd_cache_seconds. If consent is older than 31 days, re-query. Honor opt-outs immediately (voice + SMS + email + carrier lead-vendor sync). EBR exemption: 18 months from last transaction, 3 months from last inquiry — does NOT override an internal DNC. AI voice disclosure prepends every outbound opener (FCC FCC 24-17).\n\nINBOUND TRIAGE (first 15 seconds):\n  • New-business quote — identify LOB, run carrier + license gates, call startQuoteIntake.\n  • Existing-client servicing — verify identity, route by intent: ID card, COI (issueCOI if commercial + cert holder on file), billing, payment (handoff to carrier IVR — never take card data), endorsement (collect, ticket, do NOT bind).\n  • FNOL — triageFNOL with urgency (injuries / drivable / habitable), then warm-transfer to the carrier claims line. Agency rarely adjusts.\n  • Solicitor / vendor — decline politely.\n\nRECORDING DISCLOSURE: At the very top of every call, before any other content. For two-party-consent states (CA, FL, IL, MD, MA, MT, NH, PA, WA, etc.), verbatim and explicit. Medicare calls are recorded regardless.",
    "guardrails": [
      "Never quote a bindable premium, recommend coverage, or bind a policy.",
      "Never describe or quote a carrier without a passing checkCarrierAppointment for state × LOB.",
      "Never offer a quote without a passing checkProducerLicense for state × LOB.",
      "Medicare: TPMO disclaimer BEFORE benefits, SOA captured BEFORE plan-benefit discussion, full recording with retention class.",
      "Outbound: queryRND + scrubDNC + AI voice disclosure are blocking pre-conditions.",
      "Recording disclosure is the first line on every call; two-party-consent states get it verbatim.",
      "Honor opt-outs across voice + SMS + email immediately; sync to all carrier lead-vendor partners."
    ]
  }'::jsonb,
  'Tier-C insurance pack — TCPA + RND + DNC + CMS Medicare TPMO + carrier-appointment gating + state-producer-license gating. Hard split between personal lines (auto/home/umbrella) — comparative-rater push (EZLynx/PL Rating/TurboRater); commercial lines (BOP/GL/WC) — ACORD intake + producer handoff; life/final-expense — needs analysis + producer handoff; Medicare — SOA-before-substance, TPMO disclaimer at correct placement, 100% recording with retention-class routing per CY2024 + CY2026 + CY2027 final rules. AMS adapters for Applied Epic, EZLynx, AMS360, HawkSoft, NowCerts. RND scrub via reassigned.us / PossibleNOW / Gryphon. AEP / MA-OEP campaign-mode aware.'
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
