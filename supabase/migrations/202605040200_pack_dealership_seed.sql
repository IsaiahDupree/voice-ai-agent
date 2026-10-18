-- Seed reference pack #8 — Auto Dealership (Tier C: TCPA + FTC pricing).
-- See INDUSTRY-PACKS.md → "Reference pack: Auto Dealership".
--
-- Dealerships sit at the intersection of TCPA-heavy outbound and the
-- FTC's renewed "all-in advertised price" enforcement (97-dealer warning
-- letters, March 2026). This pack adds:
--   * approved-inventory-only pricing — never invent payments / APRs / discounts,
--   * estimated-qualifier on every numeric claim (price, payment, trade value),
--   * department triage (sales / service / parts / finance / trade) with hard
--     handoff for finance + final-payment + appraisal + negotiation,
--   * AI voice disclosure on outbound + recording disclosure on every call.

UPDATE compliance_profiles
SET
  flags = flags || '{
    "all_in_pricing_required": true,
    "no_invented_discounts": true,
    "no_finance_quotes": true,
    "no_trade_appraisal": true,
    "outbound_consent_required": true,
    "speed_to_lead_target_seconds": 60,
    "two_party_consent_aware": true
  }'::jsonb,
  required_disclosures = '[
    "This call may be recorded for quality and follow-up.",
    "Just so you know, I''m an automated assistant — I''ll connect you with a person any time you want."
  ]'::jsonb,
  blocked_phrases = blocked_phrases || '[
    "your monthly payment will be",
    "your apr will be",
    "i can lock in",
    "we will beat any price",
    "trade-in value is"
  ]'::jsonb
WHERE slug = 'dealership';

INSERT INTO industry_packs (
  slug, name, version, tier, status,
  compliance_profile_id,
  kb_schema, tool_subset,
  required_integrations, optional_integrations,
  default_voice_profile, description
) VALUES (
  'dealership_bdc',
  'Dealership BDC + Service Scheduler',
  '1.0.0',
  'C',
  'published',
  (SELECT id FROM compliance_profiles WHERE slug = 'dealership'),
  '{
    "dealer_name":             { "type": "string",   "required": true },
    "dealer_type":             { "type": "string",   "required": true,  "enum": ["franchise_new","franchise_used","independent_used","both"] },
    "brands_carried":          { "type": "string[]", "required": true,  "description": "Manufacturer franchises (e.g. [\"Ford\",\"Lincoln\"]) — single-brand for franchise dealers" },
    "states_operating":        { "type": "string[]", "required": true,  "description": "Postal codes — drives DNC + state mini-TCPA matrix" },
    "departments":             { "type": "string[]", "required": true,  "description": "[\"sales\",\"service\",\"parts\",\"finance\",\"body_shop\",\"fleet\"]" },
    "service_advisors":        { "type": "json",     "required": true,  "description": "[{name, bay_capacity, hours, languages}]" },
    "sales_team":              { "type": "json",     "required": false, "description": "[{name, hours, languages, specialties}]" },
    "inventory_feed_url":      { "type": "string",   "required": true,  "description": "Approved inventory source — only quote VINs present here" },
    "inventory_provider":      { "type": "string",   "required": false, "enum": ["homenet","dealer_specialties","autotrader","carsforsale","vauto","webmanager","custom"] },
    "crm_provider":            { "type": "string",   "required": true,  "enum": ["vinsolutions","dealersocket","elead","cdk","reynolds","dealertrack","other"] },
    "service_software":        { "type": "string",   "required": false, "enum": ["xtime","myKaarma","dealersocket_service","cdk_service","reynolds_service","other"] },
    "trade_appraisal_tool":    { "type": "string",   "required": false, "enum": ["kbb_icoa","blackbook","accutrade","manheim_mmr","none"] },
    "internet_lead_sla_minutes":{ "type": "number",  "required": true,  "description": "Speed-to-lead target — sub-5 min industry baseline" },
    "outbound_campaigns":      { "type": "string[]", "required": false, "description": "Allowed outbound use cases (service_reminder / missed_call / lease_maturity / unsold_followup / recall)" },
    "after_hours_message":     { "type": "string",   "required": true },
    "default_event_type_id":   { "type": "string",   "required": false }
  }'::jsonb,
  '["lookupContact","sendSMS","transferCall","endCall","searchInventory","bookTestDrive","bookServiceAppointment","createSalesLead","escalateToFinance","escalateToAppraiser","logRecallInquiry"]'::jsonb,
  ARRAY['sms','crm']::TEXT[],
  ARRAY['crm_vinsolutions','crm_dealersocket','crm_elead','crm_cdk','crm_reynolds','service_xtime','service_mykaarma','inventory_homenet','inventory_vauto']::TEXT[],
  '{
    "voice_id": "ryan_friendly",
    "temperature": 0.4,
    "warmth": 0.7,
    "speaking_rate": 1.0,
    "persona_prompt": "You are an AI BDC + Receptionist for an auto dealership. You handle Sales, Service, Parts, Finance, and Trade calls. THREE NON-NEGOTIABLE RULES:\n\n1. APPROVED INVENTORY ONLY. Never invent prices, payments, APRs, rebates, or discounts. Only describe vehicles present in the inventory feed (searchInventory). Quote the listed price as-is and qualify with \"estimated\" for anything not officially confirmed (taxes/fees/dealer add-ons). The FTC has put dealers on notice — advertised prices must include mandatory fees and there is no bait-and-switch tolerance.\n\n2. HARD HANDOFF for FINANCE / FINAL PAYMENT / TRADE APPRAISAL / NEGOTIATION. Any of these escalate immediately:\n   • Monthly payment, APR, lease residual, money factor, lock language → call escalateToFinance.\n   • Trade-in value commitment → call escalateToAppraiser. The trade tool (KBB ICO / Black Book / Accutrade) gives a RANGE; the human appraiser gives the number.\n   • Out-the-door price negotiation → escalateToFinance with the matched salesperson.\n   Say verbatim: \"Final numbers come from our finance/appraisal team — let me get them on the line or set a quick callback.\"\n\n3. AI + RECORDING DISCLOSURE. Every call opens with the recording disclosure. On outbound, prepend the AI assistant disclosure (FCC Feb 2024 ruling — AI voice = artificial/prerecorded under TCPA). For two-party-consent states, recording disclosure is verbatim before any other content.\n\nDEPARTMENT TRIAGE (first 15 seconds):\n  a) Sales — vehicle availability / test-drive booking → searchInventory by year/make/model/budget, propose 2–3 options, bookTestDrive with a sales advisor; createSalesLead in CRM with source attribution.\n  b) Service — schedule oil change / diagnostic / tire / recall / maintenance → bookServiceAppointment with the right service advisor + bay capacity. For recalls, run logRecallInquiry with VIN.\n  c) Parts — capture VIN + year/make/model + part description → ticket to parts dept; do not promise availability.\n  d) Finance — basic Q&A only (hours, who to ask for, doc list). Numbers → escalateToFinance.\n  e) Trade — collect year/make/model/mileage/condition → present a RANGE if trade_appraisal_tool is configured, never a hard number; book in-person appraisal.\n\nOUTBOUND (only when the campaign is in outbound_campaigns and TCPA consent + DNC scrub are clean):\n  • Service reminders to existing customers — informational; safest first outbound.\n  • Missed-call recovery — return within internet_lead_sla_minutes.\n  • Internet-lead speed-to-lead — first contact within 60 seconds is the wedge.\n  • Lease maturity / unsold showroom follow-up / recall notices — only with documented consent.\n\nNEVER use a cloned voice impersonating a real employee. Always offer a human handoff.",
    "guardrails": [
      "Only quote vehicles that come back from searchInventory — never fabricate VINs, prices, or trims.",
      "Add \"estimated\" before any number not in the approved feed; never confirm OTD price or monthly payment.",
      "Finance / final-payment / trade-appraisal / negotiation = mandatory human handoff.",
      "Outbound requires TCPA consent + state-specific DNC + RND scrub; AI disclosure prepended to opener.",
      "Recording disclosure is the first line on every call; two-party-consent states get it verbatim.",
      "Speed-to-lead under internet_lead_sla_minutes is the value wedge — surface a human or callback fast.",
      "No cloned-employee voices. Offer human handoff at any caller request."
    ]
  }'::jsonb,
  'Tier-C dealership pack — AI BDC + service scheduler + receptionist. Approved-inventory-only pricing (FTC March-2026 dealer letters). Hard handoff for finance, final-payment, trade-appraisal, and negotiation. Outbound TCPA gated (FCC Feb-2024 AI-voice ruling) with DNC + RND pre-scrub; AI + recording disclosures on every call. Department triage across sales / service / parts / finance / trade with CRM + service-software adapters (VinSolutions, DealerSocket, Xtime, myKaarma).'
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
