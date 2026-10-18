-- Seed reference pack #2 — Vet Clinic (Tier B: HIPAA-style premium recall).
-- See INDUSTRY-PACKS.md → "Reference pack: Vet Clinic".
--
-- Tier B justification: not legally HIPAA (humans only), but veterinary
-- clinics treat client+patient PHI-equivalent records the same way.
-- Real regulatory weight: AVMA telehealth boundaries, no-diagnosis rule,
-- emergency triage as life-critical. Validates the compliance_profile
-- system under non-trivial constraints.

-- Compliance profile is already seeded by 202605030100_industry_packs.sql
-- as "veterinary"; we extend it here with disclosure templates + the
-- emergency triage decision tree.
UPDATE compliance_profiles
SET
  disclosure_templates = '{
    "en": "This is an automated assistant. For medical emergencies, please say emergency and we''ll connect you to the on-call team or direct you to the nearest emergency hospital."
  }'::jsonb,
  required_disclosures = '[
    "I cannot diagnose your pet or change medication doses. For anything urgent I will route you to a clinic team member or emergency hospital."
  ]'::jsonb
WHERE slug = 'veterinary';

-- The pack itself.
INSERT INTO industry_packs (
  slug, name, version, tier, status,
  compliance_profile_id,
  kb_schema, tool_subset,
  required_integrations, optional_integrations,
  default_voice_profile, description
) VALUES (
  'vet_clinic',
  'Vet Clinic Receptionist',
  '1.0.0',
  'B',
  'published',
  (SELECT id FROM compliance_profiles WHERE slug = 'veterinary'),
  '{
    "business_name":              { "type": "string",          "required": true,  "description": "Clinic display name" },
    "services_offered":           { "type": "string[]",        "required": true,  "description": "Wellness, surgery, dental, boarding, grooming, etc." },
    "species_treated":            { "type": "string[]",        "required": true,  "description": "[\"dog\", \"cat\", \"exotic\", \"avian\"] etc." },
    "doctors":                    { "type": "json",            "required": true,  "description": "[{name, credentials, services_offered, weekly_schedule}]" },
    "hours":                      { "type": "weekly_schedule", "required": true,  "description": "Front-desk hours per day" },
    "emergency_routing_number":   { "type": "phone",           "required": true,  "description": "On-call vet or partner emergency hospital" },
    "emergency_hospital_address": { "type": "string",          "required": true,  "description": "Address of nearest emergency hospital (for callers without internet)" },
    "after_hours_message":        { "type": "string",          "required": true,  "description": "What to say outside hours before routing emergencies" },
    "refill_policy":              { "type": "string",          "required": true,  "description": "Refill turnaround + which meds require visit (read at refill request time)" },
    "vaccine_policy":             { "type": "string",          "required": false, "description": "Vaccines required for boarding/grooming (DA2PP, Bordetella, rabies, etc.)" },
    "pims_provider":              { "type": "string",          "required": false, "enum": ["ezyvet", "cornerstone", "avimark", "idexx_neo", "shepherd", "pulse"] },
    "default_event_type_id":      { "type": "string",          "required": false }
  }'::jsonb,
  '["checkCalendar","bookAppointment","lookupContact","sendSMS","transferCall","endCall","escalateEmergency","createRefillRequest"]'::jsonb,
  ARRAY['calendar','sms']::TEXT[],
  ARRAY['pims_ezyvet','pims_cornerstone','pims_avimark','pims_idexx_neo','pims_shepherd','pims_pulse','crm']::TEXT[],
  '{
    "voice_id": "calm_warm_female",
    "temperature": 0.4,
    "warmth": 0.85,
    "speaking_rate": 0.95,
    "persona_prompt": "You are the receptionist at a veterinary clinic. Three rules govern every response:\n\n1. NEVER diagnose, never confirm a diagnosis, never adjust dosage. If asked, say: \"I can''t diagnose your pet — I''ll have a clinic team member call you.\"\n2. SCREEN FOR EMERGENCY FIRST. Red flags: difficulty breathing / blue gums; collapse or unable to stand; active seizure; uncontrolled bleeding; suspected toxin ingestion (chocolate, xylitol, lily, antifreeze, rodenticide, grapes/raisins, ibuprofen); bloated abdomen + retching (GDV); hit by car; eye trauma; unable to urinate (especially male cats — life-threatening); whelping/queening longer than 30 minutes per puppy/kitten with no progress.\n   On any red flag → call escalateEmergency with the symptom verbatim. Tell the caller the on-call number and the emergency hospital address. Stay on line until they say they''re moving.\n3. For routine calls: be warm, identify the pet by name, confirm species + breed when scheduling, surface vaccine status before booking boarding/grooming/surgery.\n\nRefills: capture pet name + medication + last fill date; route through createRefillRequest. Do NOT promise turnaround — read the clinic''s refill_policy verbatim.\n\nNew clients: collect pet name, species, breed, age, weight (estimated OK), reason for visit, owner contact.",
    "guardrails": [
      "Never say \"your pet has [condition]\" or \"give them [dose]\" — even if the caller insists.",
      "Never override a doctor''s prior instruction; route to clinic team.",
      "If caller mentions ANY of the red-flag symptoms, immediately call escalateEmergency before continuing other tasks.",
      "Vaccine gating: do not confirm boarding/grooming/surgery without confirming current DA2PP/Bordetella/rabies (per vaccine_policy).",
      "Refill turnaround is read from refill_policy — do not invent a timeline.",
      "If caller is in distress, lower speaking_rate and acknowledge before action: \"I hear you, let''s get help right now.\""
    ]
  }'::jsonb,
  'Tier-B vet clinic pack. AVMA telehealth boundaries, hard no-diagnosis rule, life-critical emergency-triage classifier with named red-flag list, vaccine gating before boarding/grooming/surgery, refill request flow that respects clinic policy verbatim. Optional PIMS adapters: ezyVet, Cornerstone, AVImark, IDEXX Neo, Shepherd, Pulse.'
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
