-- Migration: Contact Profile Fields
-- Implements: F0611, F0612, F0613, F0614, F0615, F0618, F0619, F0625

-- F0611: Contact industry field
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS industry TEXT;

CREATE INDEX IF NOT EXISTS idx_voice_agent_contacts_industry ON voice_agent_contacts(industry);

COMMENT ON COLUMN voice_agent_contacts.industry IS 'F0611: Contact industry/vertical (e.g., SaaS, Healthcare, Finance)';

-- F0612: Contact company field (already exists in 001_initial_schema.sql, verify and index)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'voice_agent_contacts'
    AND column_name = 'company'
  ) THEN
    ALTER TABLE voice_agent_contacts ADD COLUMN company TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_voice_agent_contacts_company ON voice_agent_contacts(company);

COMMENT ON COLUMN voice_agent_contacts.company IS 'F0612: Company name';

-- F0613: Contact title field
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS title TEXT;

CREATE INDEX IF NOT EXISTS idx_voice_agent_contacts_title ON voice_agent_contacts(title);

COMMENT ON COLUMN voice_agent_contacts.title IS 'F0613: Job title (e.g., CEO, VP Sales, Marketing Director)';

-- F0614: Contact city field
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS city TEXT;

CREATE INDEX IF NOT EXISTS idx_voice_agent_contacts_city ON voice_agent_contacts(city);

COMMENT ON COLUMN voice_agent_contacts.city IS 'F0614: City';

-- F0615: Contact state field
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS state TEXT;

CREATE INDEX IF NOT EXISTS idx_voice_agent_contacts_state ON voice_agent_contacts(state);

COMMENT ON COLUMN voice_agent_contacts.state IS 'F0615: State/province (2-letter code)';

-- F0618: Contact lifetime value (calculated field)
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS lifetime_value NUMERIC(10, 2) DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_voice_agent_contacts_lifetime_value ON voice_agent_contacts(lifetime_value);

COMMENT ON COLUMN voice_agent_contacts.lifetime_value IS 'F0618: Estimated or actual lifetime value in USD';

-- F0619: Contact booking rate (calculated field - percentage 0-100)
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS booking_rate NUMERIC(5, 2) DEFAULT 0.00;

COMMENT ON COLUMN voice_agent_contacts.booking_rate IS 'F0619: Percentage of calls that resulted in bookings (0-100)';

-- F0625: Contact re-engagement flag
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS needs_reengagement BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_voice_agent_contacts_needs_reengagement ON voice_agent_contacts(needs_reengagement);

COMMENT ON COLUMN voice_agent_contacts.needs_reengagement IS 'F0625: Flag indicating contact needs re-engagement (e.g., no activity in 30+ days)';

-- F0599: Contact engagement score (0-100)
ALTER TABLE voice_agent_contacts
ADD COLUMN IF NOT EXISTS engagement_score INTEGER DEFAULT 0
CHECK (engagement_score >= 0 AND engagement_score <= 100);

CREATE INDEX IF NOT EXISTS idx_voice_agent_contacts_engagement_score ON voice_agent_contacts(engagement_score);

COMMENT ON COLUMN voice_agent_contacts.engagement_score IS 'F0599: Engagement score 0-100 based on calls, bookings, sentiment';

-- Add updated_at trigger if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_voice_agent_contacts_updated_at ON voice_agent_contacts;

CREATE TRIGGER update_voice_agent_contacts_updated_at
BEFORE UPDATE ON voice_agent_contacts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
