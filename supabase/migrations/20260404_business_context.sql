-- Business Context Engine tables
-- business_profiles: stores crawled domain profiles
-- business_pages: stores individual crawled pages
-- call_outcomes: stores Vapi post-call analysis

CREATE TABLE IF NOT EXISTS business_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT UNIQUE NOT NULL,
  company_name TEXT,
  profile JSONB,
  brief TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_business_profiles_domain ON business_profiles(domain);
CREATE INDEX idx_business_profiles_status ON business_profiles(status);

CREATE TABLE IF NOT EXISTS business_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES business_profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  crawled_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_business_pages_business_id ON business_pages(business_id);

CREATE TABLE IF NOT EXISTS call_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL,
  business_id UUID REFERENCES business_profiles(id) ON DELETE SET NULL,
  prospect_number TEXT,
  duration_seconds INTEGER,
  outcome TEXT,
  pain_points_mentioned JSONB DEFAULT '[]'::jsonb,
  objections_raised JSONB DEFAULT '[]'::jsonb,
  next_step TEXT,
  booking_confirmed BOOLEAN DEFAULT false,
  follow_up_needed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_call_outcomes_call_id ON call_outcomes(call_id);
CREATE INDEX idx_call_outcomes_business_id ON call_outcomes(business_id);

-- Auto-update updated_at on business_profiles
CREATE OR REPLACE FUNCTION update_business_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_business_profiles_updated_at
  BEFORE UPDATE ON business_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_business_profiles_updated_at();
