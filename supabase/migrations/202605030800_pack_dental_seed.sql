-- Seed reference pack #5 — Dental Clinic (Tier B + HIPAA).
-- See INDUSTRY-PACKS.md → "Reference pack: Dental Clinic".
--
-- First HIPAA-enabled pack (hipaaEnabled: true on the assistant).
-- Wedge capability: insurance verification + perio (D4910) vs prophy
-- (D1110) recall distinction read per-patient from PMS.

-- Compliance profile.
INSERT INTO compliance_profiles (slug, name, flags, required_disclosures, blocked_phrases) VALUES (
  'hipaa_dental',
  'HIPAA Dental',
  '{
    "hipaa": true,
    "phi_redaction": true,
    "baa_required": true,
    "zero_retention_llm": true,
    "two_party_consent_aware": true,
    "identity_verify_before_phi": true,
    "minimum_necessary_rule": true,
    "retention_years": 7
  }'::jsonb,
  '[
    "Before discussing any treatment or insurance details, I need to verify a couple of details so I know I''m speaking with the right person.",
    "This call may be recorded for quality assurance."
  ]'::jsonb,
  '[
    "you definitely need",
    "your diagnosis is",
    "I diagnose",
    "you have a cavity",
    "you need a root canal"
  ]'::jsonb
) ON CONFLICT (slug) DO UPDATE SET
  flags = EXCLUDED.flags,
  required_disclosures = EXCLUDED.required_disclosures,
  blocked_phrases = EXCLUDED.blocked_phrases,
  updated_at = NOW();

INSERT INTO industry_packs (
  slug, name, version, tier, status,
  compliance_profile_id,
  kb_schema, tool_subset,
  required_integrations, optional_integrations,
  default_voice_profile, description
) VALUES (
  'dental_clinic',
  'Dental Clinic Receptionist',
  '1.0.0',
  'B',
  'published',
  (SELECT id FROM compliance_profiles WHERE slug = 'hipaa_dental'),
  '{
    "business_name":             { "type": "string",          "required": true },
    "providers":                 { "type": "json",            "required": true,  "description": "[{name, credentials, accepts_new_patients, services_offered, weekly_schedule}]" },
    "hours":                     { "type": "weekly_schedule", "required": true },
    "pms_provider":              { "type": "string",          "required": true,  "enum": ["open_dental","dentrix_ascend","curve","denticon","carestack","eaglesoft"] },
    "two_party_consent_state":   { "type": "boolean",         "required": true,  "description": "True if state requires two-party consent for recording" },
    "insurance_carriers_in_network": { "type": "string[]",    "required": true,  "description": "[\"delta_dental\",\"aetna\",\"cigna\",\"metlife\",\"unitedhealthcare\"]" },
    "insurance_verify_via_stedi":{ "type": "boolean",         "required": false },
    "recall_intervals":          { "type": "json",            "required": true,  "description": "{prophy_months: 6, perio_maintenance_months: 3}" },
    "emergency_after_hours_number":{ "type": "phone",         "required": true,  "description": "On-call dentist or partner ER" },
    "new_patient_intake_url":    { "type": "string",          "required": false },
    "default_event_type_id":     { "type": "string",          "required": false }
  }'::jsonb,
  '["checkCalendar","bookAppointment","lookupContact","sendSMS","transferCall","endCall","verifyInsurance","escalateEmergency","createRefillRequest"]'::jsonb,
  ARRAY['calendar','sms','crm']::TEXT[],
  ARRAY['pms_open_dental','pms_dentrix_ascend','pms_curve','pms_denticon','pms_carestack','stedi_eligibility']::TEXT[],
  '{
    "voice_id": "elena_warm_clear",
    "temperature": 0.4,
    "warmth": 0.85,
    "speaking_rate": 0.95,
    "persona_prompt": "You are the receptionist at a dental clinic. THREE NON-NEGOTIABLE RULES:\n\n1. NEVER DIAGNOSE. Do not say a caller has a cavity, needs a root canal, has periodontal disease, etc. — even when they describe symptoms. Route to a clinical staff member with: \"I''m not able to diagnose over the phone — let me have a hygienist or doctor get back to you, or schedule you to come in.\"\n\n2. IDENTITY VERIFY BEFORE PHI. Before disclosing ANY appointment, treatment, balance, or insurance information, verify identity (full name + DOB + last 4 of phone). Do not confirm whether someone is a patient until verified. If the caller fails verification, take a callback request only.\n\n3. EMERGENCY TRIAGE FIRST. Red flags route immediately to escalateEmergency:\n   - Severe swelling of the face / under the jaw / under the tongue (Ludwig''s angina suspicion → 911-grade)\n   - Avulsed (knocked-out) permanent tooth → 60-MINUTE reimplant window — tell the caller to keep the tooth in milk or saline (not water), do NOT scrub it\n   - Uncontrolled bleeding after extraction\n   - High fever with a dental abscess\n   Read emergency_after_hours_number aloud + give nearest emergency dental address.\n\nRECALL CADENCE: When booking a hygiene appointment, look up the patient in the PMS first. If their last cleaning was a perio maintenance (D4910), book at perio_maintenance_months interval — NOT at the prophy_months interval. Confirm out loud: \"Since you''re on perio maintenance, we''ll see you in [N] months instead of six.\" This is the franchise.\n\nINSURANCE: When asked about coverage, if insurance_verify_via_stedi is true and the carrier is in insurance_carriers_in_network, trigger verifyInsurance with member_id + DOB. Quote eligibility verbatim from the response — do not estimate plan benefits.\n\nNEW PATIENTS: If accepts_new_patients is true on at least one provider AND you have new_patient_intake_url, send the intake URL via SMS after booking and remind them to bring a photo ID and insurance card.",
    "guardrails": [
      "Identity verification (name + DOB + last-4-phone) is REQUIRED before disclosing any patient information.",
      "Never diagnose — even when the caller insists or describes obvious symptoms.",
      "Avulsed tooth → 60-minute reimplant window, milk or saline, do not scrub.",
      "Perio maintenance recall (D4910) uses recall_intervals.perio_maintenance_months, NOT prophy_months. Read it back to the patient.",
      "Insurance eligibility: only quote what verifyInsurance returns; never estimate or interpret coverage.",
      "If two_party_consent_state is true, recording disclosure must be at the very top of the call before any other content."
    ]
  }'::jsonb,
  'Tier-B dental pack. First HIPAA-enabled pack (hipaaEnabled true on Vapi assistant). Identity-verify-before-PHI gate, hard no-diagnosis rule, life-critical emergency triage (Ludwig''s angina, avulsed tooth 60-min window). Wedge: perio (D4910) vs prophy (D1110) recall distinction read per-patient from PMS. Insurance-verification stub via Stedi 270/271 eligibility for in-network carriers. Optional PMS integrations: Open Dental, Dentrix Ascend, Curve, Denticon, CareStack, Eaglesoft.'
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
