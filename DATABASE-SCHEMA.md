# Database Schema

## Tables

### voice_agent_calls

Stores all call records

```sql
CREATE TABLE voice_agent_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vapi_call_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  persona_id INTEGER REFERENCES personas(id),
  campaign_id INTEGER REFERENCES campaigns(id),
  contact_id INTEGER REFERENCES contacts(id),
  status VARCHAR(50) NOT NULL, -- 'queued', 'ringing', 'in-progress', 'completed', 'failed'
  direction VARCHAR(20) NOT NULL, -- 'inbound', 'outbound'
  duration INTEGER, -- seconds
  outcome VARCHAR(50), -- 'booking_made', 'interested', 'not_interested', 'no_answer', 'voicemail'
  voicemail_detected BOOLEAN DEFAULT FALSE,
  transferred_to VARCHAR(100),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_calls_campaign ON voice_agent_calls(campaign_id);
CREATE INDEX idx_calls_contact ON voice_agent_calls(contact_id);
CREATE INDEX idx_calls_status ON voice_agent_calls(status);
CREATE INDEX idx_calls_created ON voice_agent_calls(created_at DESC);
```

### contacts

CRM contact records

```sql
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(255),
  company VARCHAR(255),
  title VARCHAR(255),
  timezone VARCHAR(50),
  tags TEXT[],
  custom_fields JSONB,
  dnc BOOLEAN DEFAULT FALSE, -- Do Not Call
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contacts_phone ON contacts(phone_number);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_dnc ON contacts(dnc) WHERE dnc = TRUE;
```

### campaigns

Outbound calling campaigns

```sql
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  persona_id INTEGER REFERENCES personas(id) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed', 'archived'
  total_contacts INTEGER DEFAULT 0,
  completed_calls INTEGER DEFAULT 0,
  bookings_made INTEGER DEFAULT 0,
  total_talk_time INTEGER DEFAULT 0, -- seconds
  voicemail_message TEXT,
  max_attempts_per_contact INTEGER DEFAULT 3,
  calling_hours_start TIME DEFAULT '09:00',
  calling_hours_end TIME DEFAULT '17:00',
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_persona ON campaigns(persona_id);
```

### campaign_contacts

Junction table for campaign contacts

```sql
CREATE TABLE campaign_contacts (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'called', 'completed', 'failed', 'dnc'
  attempt_count INTEGER DEFAULT 0,
  last_called_at TIMESTAMP WITH TIME ZONE,
  outcome VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_campaign_contacts_campaign ON campaign_contacts(campaign_id);
CREATE INDEX idx_campaign_contacts_status ON campaign_contacts(status);
```

### personas

AI agent persona configurations

```sql
CREATE TABLE personas (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  voice_id VARCHAR(255) NOT NULL, -- ElevenLabs voice ID
  system_prompt TEXT NOT NULL,
  first_message TEXT NOT NULL,
  model VARCHAR(50) DEFAULT 'gpt-4o', -- 'gpt-4o', 'claude-3-5-sonnet'
  temperature DECIMAL(3,2) DEFAULT 0.7,
  tools TEXT[], -- ['checkCalendar', 'bookAppointment', 'lookupContact']
  transfer_number VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### transcripts

Call transcripts

```sql
CREATE TABLE transcripts (
  id SERIAL PRIMARY KEY,
  call_id UUID REFERENCES voice_agent_calls(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  summary TEXT,
  sentiment VARCHAR(20), -- 'positive', 'neutral', 'negative'
  keywords TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_transcripts_call ON transcripts(call_id);
CREATE INDEX idx_transcripts_created ON transcripts(created_at DESC);
```

### bookings

Calendar appointments

```sql
CREATE TABLE bookings (
  id SERIAL PRIMARY KEY,
  call_id UUID REFERENCES voice_agent_calls(id),
  contact_id INTEGER REFERENCES contacts(id),
  calcom_booking_id INTEGER,
  calcom_uid VARCHAR(255) UNIQUE,
  title VARCHAR(255) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status VARCHAR(50) DEFAULT 'confirmed', -- 'confirmed', 'cancelled', 'rescheduled', 'completed'
  attendee_email VARCHAR(255),
  attendee_phone VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bookings_call ON bookings(call_id);
CREATE INDEX idx_bookings_contact ON bookings(contact_id);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
```

### webhook_logs

Webhook request logs

```sql
CREATE TABLE webhook_logs (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,
  headers JSONB,
  payload JSONB,
  response_status INTEGER,
  processing_time_ms INTEGER,
  error TEXT,
  idempotency_key VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_endpoint ON webhook_logs(endpoint);
CREATE INDEX idx_webhook_logs_idempotency ON webhook_logs(idempotency_key);
CREATE INDEX idx_webhook_logs_created ON webhook_logs(created_at DESC);
```

## Row Level Security (RLS)

Enable RLS on all tables:

```sql
ALTER TABLE voice_agent_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Example policy: Users can only access their own data
CREATE POLICY "Users can view their own calls"
  ON voice_agent_calls
  FOR SELECT
  USING (auth.uid() = user_id);
```

## Migrations

Migrations are stored in `supabase/migrations/`:
- `001_initial_schema.sql`
- `002_add_personas.sql`
- `003_add_campaigns.sql`
- `004_add_webhooks.sql`

Apply migrations:
```bash
supabase db push
```

## Common Queries

### Active campaigns with stats
```sql
SELECT
  c.id,
  c.name,
  c.status,
  c.total_contacts,
  c.completed_calls,
  c.bookings_made,
  ROUND((c.bookings_made::DECIMAL / NULLIF(c.completed_calls, 0)) * 100, 2) AS conversion_rate
FROM campaigns c
WHERE c.status = 'active'
ORDER BY c.created_at DESC;
```

### Recent calls with outcomes
```sql
SELECT
  vc.id,
  vc.phone_number,
  c.full_name,
  vc.status,
  vc.outcome,
  vc.duration,
  vc.started_at
FROM voice_agent_calls vc
LEFT JOIN contacts c ON vc.contact_id = c.id
WHERE vc.created_at > NOW() - INTERVAL '24 hours'
ORDER BY vc.created_at DESC;
```

### Conversion funnel
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'completed') AS total_calls,
  COUNT(*) FILTER (WHERE outcome = 'interested') AS interested,
  COUNT(*) FILTER (WHERE outcome = 'booking_made') AS bookings,
  ROUND((COUNT(*) FILTER (WHERE outcome = 'booking_made')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE status = 'completed'), 0)) * 100, 2) AS conversion_rate
FROM voice_agent_calls
WHERE created_at > NOW() - INTERVAL '7 days';
```
