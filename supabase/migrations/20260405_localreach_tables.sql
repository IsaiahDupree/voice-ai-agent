-- LocalReach V3: Autonomous Cold-Calling System Tables
-- Migration: 20260405_localreach_tables

-- ============================================
-- 1. Businesses (sourced from Google Maps)
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  google_place_id TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_e164 TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  website TEXT,
  google_rating DOUBLE PRECISION,
  review_count INTEGER DEFAULT 0,
  niche TEXT,
  niche_tags TEXT[] DEFAULT '{}',
  source_campaign_id UUID,
  source_radius_ring INTEGER,
  timezone TEXT DEFAULT 'America/New_York',
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'enriched', 'queued', 'called', 'converted', 'suppressed', 'dnc')),
  last_called_at TIMESTAMPTZ,
  last_enriched_at TIMESTAMPTZ,
  suppressed_until TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_localreach_businesses_phone ON localreach_businesses(phone_e164);
CREATE INDEX IF NOT EXISTS idx_localreach_businesses_niche ON localreach_businesses(niche);
CREATE INDEX IF NOT EXISTS idx_localreach_businesses_status ON localreach_businesses(status);
CREATE INDEX IF NOT EXISTS idx_localreach_businesses_geo ON localreach_businesses(lat, lng);

-- ============================================
-- 2. Business Research (enrichment results)
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_business_research (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES localreach_businesses(id) ON DELETE CASCADE,
  services TEXT[] DEFAULT '{}',
  pain_points TEXT[] DEFAULT '{}',
  tech_signals TEXT[] DEFAULT '{}',
  recommended_offers TEXT[] DEFAULT '{}',
  tone TEXT,
  brand_voice TEXT,
  brief TEXT,
  full_analysis JSONB DEFAULT '{}',
  crawl_status TEXT DEFAULT 'pending' CHECK (crawl_status IN ('pending', 'crawling', 'completed', 'failed')),
  crawl_error TEXT,
  pages_crawled INTEGER DEFAULT 0,
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_localreach_research_business ON localreach_business_research(business_id);

-- ============================================
-- 3. Offers Library
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_offers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  niche_tags TEXT[] DEFAULT '{}',
  price_cents INTEGER NOT NULL,
  discount_threshold_percent INTEGER DEFAULT 0,
  elevator_pitch TEXT,
  objection_responses JSONB DEFAULT '{}',
  stripe_price_id TEXT,
  stripe_product_id TEXT,
  features TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Campaigns
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  niche TEXT NOT NULL,
  offer_id UUID REFERENCES localreach_offers(id),
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_miles INTEGER DEFAULT 30,
  current_radius_ring INTEGER DEFAULT 0,
  daily_call_quota INTEGER DEFAULT 50,
  calls_today INTEGER DEFAULT 0,
  calls_today_reset_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived', 'completed')),
  calling_hours JSONB DEFAULT '{"start": "08:00", "end": "20:00", "timezone": "America/New_York"}',
  schedule JSONB DEFAULT '{}',
  stats JSONB DEFAULT '{"targeted": 0, "called": 0, "answered": 0, "booked": 0, "paid": 0, "suppressed": 0}',
  assistant_id TEXT,
  phone_number_id TEXT,
  started_at TIMESTAMPTZ,
  paused_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_localreach_campaigns_status ON localreach_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_localreach_campaigns_niche ON localreach_campaigns(niche);

-- ============================================
-- 5. Call Attempts
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_call_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES localreach_campaigns(id),
  business_id UUID NOT NULL REFERENCES localreach_businesses(id),
  offer_id UUID REFERENCES localreach_offers(id),
  vapi_call_id TEXT,
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'ringing', 'answered', 'voicemail', 'no_answer', 'busy', 'failed', 'completed')),
  outcome TEXT CHECK (outcome IN ('interested', 'not_interested', 'callback', 'booked', 'paid', 'dnc_request', 'wrong_number', 'voicemail_left', NULL)),
  duration_seconds INTEGER,
  recording_url TEXT,
  transcript TEXT,
  objections_encountered TEXT[] DEFAULT '{}',
  discount_offered BOOLEAN DEFAULT FALSE,
  discount_percent INTEGER,
  voicemail_dropped BOOLEAN DEFAULT FALSE,
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_localreach_calls_campaign ON localreach_call_attempts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_localreach_calls_business ON localreach_call_attempts(business_id);
CREATE INDEX IF NOT EXISTS idx_localreach_calls_status ON localreach_call_attempts(status);

-- ============================================
-- 6. Objection Library
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_objections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_type TEXT NOT NULL,
  objection_key TEXT NOT NULL,
  detection_phrases TEXT[] NOT NULL,
  response_script TEXT NOT NULL,
  escalation_path TEXT DEFAULT 'none' CHECK (escalation_path IN ('none', 'discount', 'human_transfer', 'schedule_callback')),
  escalation_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_localreach_objections_key ON localreach_objections(offer_type, objection_key);

-- ============================================
-- 7. Conversions (bookings + payments)
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_conversions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  call_attempt_id UUID REFERENCES localreach_call_attempts(id),
  business_id UUID NOT NULL REFERENCES localreach_businesses(id),
  campaign_id UUID REFERENCES localreach_campaigns(id),
  offer_id UUID REFERENCES localreach_offers(id),
  type TEXT NOT NULL CHECK (type IN ('booking', 'payment', 'callback')),
  calendly_event_id TEXT,
  calendly_url TEXT,
  stripe_payment_id TEXT,
  stripe_payment_link TEXT,
  stripe_amount_cents INTEGER,
  sms_sent BOOLEAN DEFAULT FALSE,
  sms_sid TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'refunded')),
  scheduled_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_localreach_conversions_business ON localreach_conversions(business_id);
CREATE INDEX IF NOT EXISTS idx_localreach_conversions_campaign ON localreach_conversions(campaign_id);

-- ============================================
-- 8. Compliance Events
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_compliance_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  business_id UUID REFERENCES localreach_businesses(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('dnc_check', 'suppression_check', 'consent_check', 'calling_hours_check', 'dnc_request', 'suppression_added', 'b2b_verification')),
  result TEXT NOT NULL CHECK (result IN ('allowed', 'blocked', 'warning')),
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_localreach_compliance_phone ON localreach_compliance_events(phone);
CREATE INDEX IF NOT EXISTS idx_localreach_compliance_type ON localreach_compliance_events(event_type);

-- ============================================
-- 9. Suppression List
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_suppression_list (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  phone_e164 TEXT UNIQUE NOT NULL,
  reason TEXT DEFAULT 'manual',
  source TEXT DEFAULT 'internal',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_localreach_suppression_phone ON localreach_suppression_list(phone_e164);

-- ============================================
-- 10. Niche Weekly Schedule
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_niche_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  niche TEXT NOT NULL,
  campaign_id UUID REFERENCES localreach_campaigns(id),
  is_override BOOLEAN DEFAULT FALSE,
  override_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_localreach_schedule_day ON localreach_niche_schedule(day_of_week);

-- ============================================
-- 11. Geo Coverage Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS localreach_geo_coverage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES localreach_campaigns(id),
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  ring_index INTEGER NOT NULL,
  inner_radius_miles DOUBLE PRECISION NOT NULL,
  outer_radius_miles DOUBLE PRECISION NOT NULL,
  businesses_found INTEGER DEFAULT 0,
  businesses_called INTEGER DEFAULT 0,
  quarter TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_localreach_coverage_campaign ON localreach_geo_coverage(campaign_id);
CREATE INDEX IF NOT EXISTS idx_localreach_coverage_quarter ON localreach_geo_coverage(quarter);

-- Enable RLS
ALTER TABLE localreach_businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE localreach_business_research ENABLE ROW LEVEL SECURITY;
ALTER TABLE localreach_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE localreach_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE localreach_call_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE localreach_objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE localreach_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE localreach_compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE localreach_suppression_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE localreach_niche_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE localreach_geo_coverage ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access for server-side operations)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'localreach_businesses', 'localreach_business_research', 'localreach_offers',
    'localreach_campaigns', 'localreach_call_attempts', 'localreach_objections',
    'localreach_conversions', 'localreach_compliance_events', 'localreach_suppression_list',
    'localreach_niche_schedule', 'localreach_geo_coverage'
  ]) LOOP
    EXECUTE format('CREATE POLICY "service_role_all_%s" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl, tbl);
  END LOOP;
END$$;

-- Enable realtime for dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE localreach_call_attempts;
ALTER PUBLICATION supabase_realtime ADD TABLE localreach_campaigns;
