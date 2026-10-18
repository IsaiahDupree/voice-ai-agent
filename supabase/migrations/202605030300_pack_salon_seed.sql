-- Seed reference pack #1 — Salon / Barbershop (Tier A: fast-launch wedge).
-- See INDUSTRY-PACKS.md → "Reference pack: Salon / Barbershop / Beauty".
--
-- Tier A justification: minimal compliance, plain MMS for inspo photos,
-- no HIPAA/BAA — fastest validation path for the pack architecture.

-- Compliance profile for salons (added separately so other beauty packs
-- can reuse it).
INSERT INTO compliance_profiles (slug, name, flags, blocked_phrases) VALUES (
  'salon_baseline',
  'Salon / Barbershop',
  '{
    "patch_test_disclosure": true,
    "cancellation_policy_enforcement": true,
    "booth_renter_aware": true,
    "request_your_stylist_dominant_intent": true,
    "color_duration_clarification_required": true,
    "phi": false,
    "hipaa": false
  }'::jsonb,
  '["that color will look amazing on you", "guaranteed to match"]'::jsonb
) ON CONFLICT (slug) DO NOTHING;

-- The pack itself.
INSERT INTO industry_packs (
  slug, name, version, tier, status,
  compliance_profile_id,
  kb_schema, tool_subset,
  required_integrations, optional_integrations,
  default_voice_profile, description
) VALUES (
  'salon_barbershop',
  'Salon & Barbershop Receptionist',
  '1.0.0',
  'A',
  'published',
  (SELECT id FROM compliance_profiles WHERE slug = 'salon_baseline'),
  '{
    "business_name":            { "type": "string",            "required": true,  "description": "Salon display name" },
    "services_offered":         { "type": "string[]",          "required": true,  "description": "List of services (cut, color, balayage, beard, etc.)" },
    "stylists":                 { "type": "json",              "required": true,  "description": "[{name, employment: \"w2\"|\"booth_renter\", services_offered, default_duration_min}]" },
    "hours":                    { "type": "weekly_schedule",   "required": true,  "description": "Weekly hours per day" },
    "cancellation_policy":      { "type": "string",            "required": true,  "description": "Plain-text cancellation policy (read on book + reminders)" },
    "patch_test_required_for":  { "type": "string[]",          "required": false, "description": "Services that require 48h patch test (e.g., color)" },
    "deposit_policy":           { "type": "string",            "required": false, "description": "If non-empty, requires deposit on book" },
    "default_event_type_id":    { "type": "string",            "required": false, "description": "Cal.com event type for default booking" }
  }'::jsonb,
  '["checkCalendar","bookAppointment","lookupContact","sendSMS","transferCall","endCall"]'::jsonb,
  ARRAY['calendar','sms','crm']::TEXT[],
  ARRAY['booksy','square_appointments','vagaro','mindbody','fresha','boulevard','glossgenius']::TEXT[],
  '{
    "voice_id": "rachel",
    "temperature": 0.5,
    "warmth": 0.7,
    "speaking_rate": 1.0,
    "persona_prompt": "You are a friendly, professional salon receptionist. Default behavior: when a returning client calls, look them up and offer their last stylist + last service first. For color services, always confirm last color date, current color, and length so duration is right (root touch-up vs balayage vs correction). For booth-renter stylists, only their personal calendar is bookable — never imply the salon owns their book. Quote prices only from services_offered; if asked for a price not on the menu, say you’ll have the stylist follow up. Read the cancellation policy at end of booking and confirm the client heard it.",
    "guardrails": [
      "Never confirm a color result will match a photo or look exactly like a celebrity.",
      "If a stylist is a booth_renter, do not share their schedule with the salon-side caller without permission; only quote their available slots.",
      "If patch test is required and last patch test was >6 months ago or unknown, schedule a patch-test slot 48h before color.",
      "If a service requires a deposit (deposit_policy non-empty), collect or send a payment link before confirming.",
      "Never accept tips by phone — direct to in-person."
    ]
  }'::jsonb,
  'Tier-A salon & barbershop pack. Handles request-your-stylist routing, color-bucket clarification, patch-test gating, cancellation-policy enforcement, and booth-renter-aware booking. No HIPAA. Fastest onboarding pack in the catalog.'
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
