-- Seed reference pack #3 — Restaurant (Tier A: peak-hour concurrency).
-- See INDUSTRY-PACKS.md → "Reference pack: Restaurant".
--
-- Validates the "flag + transfer, never confirm safety" allergen pattern
-- and the multilingual-by-default opener.

-- Extend the restaurant compliance profile seeded by the Phase 1 migration.
UPDATE compliance_profiles
SET
  disclosure_templates = '{
    "en": "Thanks for calling — your call may be recorded for quality.",
    "es": "Gracias por llamar — su llamada puede ser grabada para control de calidad."
  }'::jsonb,
  required_disclosures = '[
    "I can take your reservation, takeout, or general info — but for allergen safety I will pass you to staff."
  ]'::jsonb
WHERE slug = 'restaurant';

INSERT INTO industry_packs (
  slug, name, version, tier, status,
  compliance_profile_id,
  kb_schema, tool_subset,
  required_integrations, optional_integrations,
  default_voice_profile, description
) VALUES (
  'restaurant',
  'Restaurant Host',
  '1.0.0',
  'A',
  'published',
  (SELECT id FROM compliance_profiles WHERE slug = 'restaurant'),
  '{
    "business_name":          { "type": "string",          "required": true },
    "cuisine":                { "type": "string",          "required": true },
    "hours":                  { "type": "weekly_schedule", "required": true },
    "reservations_enabled":   { "type": "boolean",         "required": true },
    "reservation_platform":   { "type": "string",          "required": false, "enum": ["opentable","resy","tock","sevenrooms","yelp"] },
    "takeout_enabled":        { "type": "boolean",         "required": true },
    "delivery_enabled":       { "type": "boolean",         "required": true },
    "third_party_delivery":   { "type": "string[]",        "required": false, "description": "[\"doordash\",\"ubereats\",\"grubhub\"]" },
    "menu_url":               { "type": "string",          "required": false },
    "private_dining_email":   { "type": "email",           "required": false, "description": "Catering / private events triage destination" },
    "languages_supported":    { "type": "string[]",        "required": true,  "description": "[\"en\",\"es\"]" },
    "dress_code":             { "type": "string",          "required": false },
    "kids_friendly":          { "type": "boolean",         "required": false },
    "max_party_size":         { "type": "number",          "required": false, "description": "Above this, route to private_dining_email" },
    "allergen_transfer_phone":{ "type": "phone",           "required": true,  "description": "Number to transfer allergen questions to (kitchen mgr / floor mgr)" },
    "default_event_type_id":  { "type": "string",          "required": false }
  }'::jsonb,
  '["checkCalendar","bookAppointment","sendSMS","transferCall","endCall","flagAllergenAndTransfer"]'::jsonb,
  ARRAY['calendar','sms']::TEXT[],
  ARRAY['opentable','resy','tock','sevenrooms','crm']::TEXT[],
  '{
    "voice_id": "sofia_warm",
    "temperature": 0.55,
    "warmth": 0.8,
    "speaking_rate": 1.0,
    "persona_prompt": "You are the host at a restaurant. Be quick, warm, and concrete. Greet in the caller''s language if it isn''t English.\n\nThree calls dominate: reservation, takeout, hours/menu/directions. Resolve each in under 60 seconds when possible.\n\nALLERGEN PATTERN — never confirm safety. If the caller asks whether anything is gluten-free, nut-free, dairy-free, vegan-safe, contains a specific allergen, etc., immediately call flagAllergenAndTransfer with the allergen, then route to allergen_transfer_phone. Do NOT say \"yes that''s safe\" or \"we can make it [allergen]-free\" under any circumstance.\n\nLARGE PARTIES — if max_party_size is set and the caller asks for more than that, route to private_dining_email instead of booking. Do NOT split a large party into multiple reservations.\n\nTAKEOUT — if takeout_enabled is true, take name, phone, items + qty. Repeat order back. Quote a pickup time as a 15-minute window (e.g., \"between 6:30 and 6:45\").",
    "guardrails": [
      "Never confirm allergen safety — always flag and transfer.",
      "Never split a >max_party_size group into multiple back-to-back reservations.",
      "If reservations_enabled is false, say so plainly and offer a walk-in time estimate from hours.",
      "Quote menu prices only when menu_url-derived; otherwise say \"I''ll have someone confirm price.\"",
      "Greet in the caller''s detected language when it''s in languages_supported."
    ]
  }'::jsonb,
  'Tier-A restaurant pack. Optimized for peak-hour 60-second resolution: reservation, takeout, hours/menu, large-party triage. Allergen-safety pattern enforced (flag + transfer, never confirm). Multilingual by default. Integrates with OpenTable / Resy / Tock / SevenRooms via the calendar provider abstraction.'
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
