-- F1027: calls: cost_usd column - NUMERIC(8,4) from Vapi
-- F1030: calls: transfer_outcome column - TEXT nullable success/failed
-- F1072: contacts: tags - TEXT[]
-- F1086: bookings: cancellation_reason - TEXT nullable
-- F1112: organizations table - Multi-tenancy support
-- F1127: feedback table - CSAT feedback collection
-- F1468: waitlist table - Cal.com waitlist entries

-- F1027: Add cost_usd column to calls table
ALTER TABLE voice_agent_calls
ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(8,4);

-- F1030: Add transfer_outcome column to calls table
ALTER TABLE voice_agent_calls
ADD COLUMN IF NOT EXISTS transfer_outcome TEXT CHECK (transfer_outcome IN ('success', 'failed', NULL));

-- F1072: Add tags array column to contacts table
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Create index on tags for faster searches
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON voice_agent_contacts USING GIN (tags);

-- F1086: Add cancellation_reason to bookings table
ALTER TABLE voice_agent_bookings
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- F1112: Create organizations table for multi-tenancy
CREATE TABLE IF NOT EXISTS voice_agent_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  billing_email TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro', 'enterprise')),
  max_assistants INTEGER DEFAULT 1,
  max_calls_per_month INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB DEFAULT '{}'::jsonb
);

-- Add organization_id to key tables
ALTER TABLE voice_agent_assistants
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES voice_agent_organizations(id);

ALTER TABLE voice_agent_calls
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES voice_agent_organizations(id);

ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES voice_agent_organizations(id);

ALTER TABLE voice_agent_campaigns
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES voice_agent_organizations(id);

-- Create indexes for organization_id
CREATE INDEX IF NOT EXISTS idx_assistants_org ON voice_agent_assistants(organization_id);
CREATE INDEX IF NOT EXISTS idx_calls_org ON voice_agent_calls(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_org ON voice_agent_contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_org ON voice_agent_campaigns(organization_id);

-- F1127: Create feedback/CSAT table
CREATE TABLE IF NOT EXISTS voice_agent_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id TEXT NOT NULL,
  organization_id UUID REFERENCES voice_agent_organizations(id),
  contact_id UUID,
  phone_number TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,
  nps_score INTEGER CHECK (nps_score >= 0 AND nps_score <= 10),
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT DEFAULT 'post_call' CHECK (source IN ('post_call', 'sms', 'email', 'web')),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_feedback_call ON voice_agent_feedback(call_id);
CREATE INDEX IF NOT EXISTS idx_feedback_org ON voice_agent_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON voice_agent_feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_collected ON voice_agent_feedback(collected_at DESC);

-- F1468: Create waitlist table for Cal.com waitlist entries
CREATE TABLE IF NOT EXISTS voice_agent_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES voice_agent_organizations(id),
  event_type_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  requested_date DATE,
  requested_time TIME,
  alternative_dates DATE[] DEFAULT '{}',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'booked', 'cancelled', 'expired')),
  priority INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  contacted_at TIMESTAMPTZ,
  booked_at TIMESTAMPTZ,
  booking_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_waitlist_org ON voice_agent_waitlist(organization_id);
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON voice_agent_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON voice_agent_waitlist(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON voice_agent_waitlist(email);

-- Add comments for documentation
COMMENT ON COLUMN voice_agent_calls.cost_usd IS 'F1027: Call cost in USD from Vapi';
COMMENT ON COLUMN voice_agent_calls.transfer_outcome IS 'F1030: Outcome of call transfer (success/failed)';
COMMENT ON COLUMN voice_agent_contacts.tags IS 'F1072: Contact tags for categorization';
COMMENT ON COLUMN voice_agent_bookings.cancellation_reason IS 'F1086: Reason for booking cancellation';
COMMENT ON TABLE voice_agent_organizations IS 'F1112: Organizations for multi-tenancy';
COMMENT ON TABLE voice_agent_feedback IS 'F1127: CSAT and NPS feedback collection';
COMMENT ON TABLE voice_agent_waitlist IS 'F1468: Cal.com waitlist entries';
