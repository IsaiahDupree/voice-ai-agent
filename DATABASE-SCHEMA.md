# Database Schema

## Tables

### Multi-Tenant Tables (Feature 145)

#### tenants

Stores tenant (business/client) records for multi-tenancy

```sql
CREATE TABLE tenants (
  id TEXT PRIMARY KEY, -- e.g., 'tenant_abc123' or custom slug
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL, -- URL-safe identifier (e.g., 'acme-corp')
  phone_numbers TEXT[] NOT NULL DEFAULT '{}', -- Array of E.164 phone numbers owned by tenant
  plan VARCHAR(50) NOT NULL DEFAULT 'free', -- 'free', 'starter', 'pro', 'enterprise'
  settings JSONB NOT NULL DEFAULT '{}', -- Custom tenant settings, feature flags
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_phone_numbers ON tenants USING GIN (phone_numbers);
```

#### tenant_configs

Tenant-specific assistant and configuration settings

```sql
CREATE TABLE tenant_configs (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  kb_namespace VARCHAR(255) NOT NULL, -- Isolated KB namespace (e.g., 'acme-corp-kb')
  assistant_id VARCHAR(255), -- Vapi assistant ID
  persona_name VARCHAR(255),
  voice_id VARCHAR(255), -- ElevenLabs voice ID
  system_prompt TEXT,
  timezone VARCHAR(50) DEFAULT 'America/New_York',
  business_hours JSONB NOT NULL DEFAULT '{}', -- { "monday": { "open": "09:00", "close": "17:00" }, ... }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id)
);

CREATE INDEX idx_tenant_configs_tenant ON tenant_configs(tenant_id);
```

#### tenant_api_keys

API keys for tenant-scoped authentication

```sql
CREATE TABLE tenant_api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL, -- Human-readable name (e.g., 'Production API Key')
  key_hash TEXT NOT NULL UNIQUE, -- SHA-256 hash of API key
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'revoked'
  scopes TEXT[] NOT NULL DEFAULT '{}', -- ['calls:read', 'contacts:write', ...]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_tenant_api_keys_tenant ON tenant_api_keys(tenant_id);
CREATE INDEX idx_tenant_api_keys_hash ON tenant_api_keys(key_hash);
CREATE INDEX idx_tenant_api_keys_status ON tenant_api_keys(status) WHERE status = 'active';
```

### voice_agent_calls

Stores all call records (multi-tenant)

```sql
CREATE TABLE voice_agent_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vapi_call_id VARCHAR(255) UNIQUE NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  persona_id INTEGER REFERENCES personas(id),
  campaign_id INTEGER REFERENCES campaigns(id),
  contact_id INTEGER REFERENCES contacts(id),
  tenant_id TEXT REFERENCES tenants(id), -- Multi-tenant isolation
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
CREATE INDEX idx_calls_tenant ON voice_agent_calls(tenant_id);
```

### contacts

CRM contact records (multi-tenant)

```sql
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  company VARCHAR(255),
  title VARCHAR(255),
  timezone VARCHAR(50),
  tags TEXT[],
  custom_fields JSONB,
  dnc BOOLEAN DEFAULT FALSE, -- Do Not Call
  tenant_id TEXT REFERENCES tenants(id), -- Multi-tenant isolation
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(phone_number, tenant_id) -- Phone numbers unique per tenant
);

CREATE INDEX idx_contacts_phone ON contacts(phone_number);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_dnc ON contacts(dnc) WHERE dnc = TRUE;
CREATE INDEX idx_contacts_tenant ON contacts(tenant_id);
```

### campaigns

Outbound calling campaigns (multi-tenant)

```sql
CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  persona_id INTEGER REFERENCES personas(id) NOT NULL,
  tenant_id TEXT REFERENCES tenants(id), -- Multi-tenant isolation
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
CREATE INDEX idx_campaigns_tenant ON campaigns(tenant_id);
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

### V2 Feature Tables

#### kb_documents

Knowledge base documents (multi-tenant, V2 Feature 1)

```sql
CREATE TABLE kb_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT REFERENCES tenants(id) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  file_type VARCHAR(50), -- 'pdf', 'docx', 'txt', 'url'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kb_documents_tenant ON kb_documents(tenant_id);
CREATE INDEX idx_kb_documents_created ON kb_documents(created_at DESC);
```

#### kb_embeddings

Vector embeddings for KB search (multi-tenant, V2 Feature 1)

```sql
-- Requires pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE kb_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES kb_documents(id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES tenants(id) NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  chunk_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_kb_embeddings_document ON kb_embeddings(document_id);
CREATE INDEX idx_kb_embeddings_tenant ON kb_embeddings(tenant_id);
CREATE INDEX idx_kb_embeddings_vector ON kb_embeddings USING ivfflat (embedding vector_cosine_ops);
```

#### caller_memory

Caller history and personalization (multi-tenant, V2 Feature 2)

```sql
CREATE TABLE caller_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_number VARCHAR(20) NOT NULL,
  tenant_id TEXT REFERENCES tenants(id) NOT NULL,
  display_name VARCHAR(255),
  call_count INTEGER DEFAULT 0,
  first_call_at TIMESTAMP WITH TIME ZONE,
  last_call_at TIMESTAMP WITH TIME ZONE,
  summary TEXT, -- AI-generated relationship summary
  preferences JSONB DEFAULT '{}', -- Caller preferences (language, topics, pain points)
  relationship_score INTEGER DEFAULT 0, -- 0-100
  last_offer_made TEXT,
  last_offer_outcome TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(phone_number, tenant_id)
);

CREATE INDEX idx_caller_memory_phone ON caller_memory(phone_number);
CREATE INDEX idx_caller_memory_tenant ON caller_memory(tenant_id);
CREATE INDEX idx_caller_memory_score ON caller_memory(relationship_score DESC);
```

#### live_transcripts

Live streaming transcript chunks (multi-tenant, V2 Feature 7)

```sql
CREATE TABLE live_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES voice_agent_calls(id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES tenants(id),
  speaker VARCHAR(20) NOT NULL, -- 'agent' or 'caller'
  text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sequence_num INTEGER NOT NULL, -- Order of chunks in call
  sentiment_score DECIMAL(3,2), -- -1.0 to 1.0
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_live_transcripts_call ON live_transcripts(call_id);
CREATE INDEX idx_live_transcripts_sequence ON live_transcripts(call_id, sequence_num);
CREATE INDEX idx_live_transcripts_tenant ON live_transcripts(tenant_id);
```

#### call_evaluations

LLM-as-judge call evaluations (multi-tenant, V2 Feature 6)

```sql
CREATE TABLE call_evaluations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  call_id UUID REFERENCES voice_agent_calls(id) ON DELETE CASCADE,
  tenant_id TEXT REFERENCES tenants(id),
  evaluation JSONB NOT NULL, -- Structured evaluation JSON
  goal_achieved BOOLEAN,
  overall_score DECIMAL(4,2), -- 0-10
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_call_evaluations_call ON call_evaluations(call_id);
CREATE INDEX idx_call_evaluations_tenant ON call_evaluations(tenant_id);
CREATE INDEX idx_call_evaluations_score ON call_evaluations(overall_score DESC);
```

#### mcp_registry

MCP server registry for tool bridge (multi-tenant, V2 Feature 9)

```sql
CREATE TABLE mcp_registry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT REFERENCES tenants(id),
  server_name VARCHAR(255) NOT NULL,
  server_url TEXT NOT NULL,
  auth_type VARCHAR(50), -- 'none', 'api_key', 'oauth'
  auth_config JSONB DEFAULT '{}',
  enabled_tools TEXT[] NOT NULL DEFAULT '{}',
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'inactive', 'error'
  description TEXT,
  last_health_check_at TIMESTAMP WITH TIME ZONE,
  health_status JSONB DEFAULT '{}', -- { "status": "healthy", "latency_ms": 45, "error": null }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, server_name)
);

CREATE INDEX idx_mcp_registry_tenant ON mcp_registry(tenant_id);
CREATE INDEX idx_mcp_registry_status ON mcp_registry(status) WHERE status = 'active';
```

#### conversation_flows

Visual flow builder state machines (multi-tenant, V2 Feature 10)

```sql
CREATE TABLE conversation_flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id TEXT REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  nodes JSONB NOT NULL, -- ReactFlow nodes
  edges JSONB NOT NULL, -- ReactFlow edges
  version INTEGER DEFAULT 1,
  vapi_assistant_id VARCHAR(255), -- Exported Vapi assistant
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversation_flows_tenant ON conversation_flows(tenant_id);
CREATE INDEX idx_conversation_flows_name ON conversation_flows(name);
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
