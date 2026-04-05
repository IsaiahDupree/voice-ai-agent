# Deployment Guide

## Prerequisites

1. **Vapi.ai Account** - Sign up at https://vapi.ai
2. **Supabase Project** - Already configured (ivhfuhxorppptyuofbgq)
3. **Twilio Account** - For SMS (optional)
4. **Cal.com Account** - For appointment booking (optional)
5. **Vercel Account** - For deployment

## Step 1: Database Setup

### Apply Supabase Migration

You can apply the migration using the Supabase MCP tool or manually:

**Option A: Using Supabase MCP (recommended)**

```bash
# Use the mcp__supabase__apply_migration tool
# with the migration file path:
# /Users/isaiahdupree/Documents/Software/tech-demos/voice-ai-agent/supabase/migrations/001_initial_schema.sql
```

**Option B: Manual via Supabase Dashboard**

1. Go to https://supabase.com/dashboard/project/ivhfuhxorppptyuofbgq/sql
2. Open `supabase/migrations/001_initial_schema.sql`
3. Copy the SQL and paste into the SQL Editor
4. Click "Run"

**Option C: Using Supabase CLI**

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Link to project
supabase link --project-ref ivhfuhxorppptyuofbgq

# Push migration
supabase db push
```

### Verify Tables Created

Run this query in Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'voice_agent_%';
```

You should see:
- voice_agent_calls
- voice_agent_transcripts
- voice_agent_function_calls
- voice_agent_contacts
- voice_agent_campaigns
- voice_agent_campaign_contacts

## Step 2: Get API Keys

### Vapi.ai

1. Go to https://dashboard.vapi.ai
2. Click "API Keys"
3. Copy your API key → save as `VAPI_API_KEY`
4. Create a webhook secret → save as `VAPI_WEBHOOK_SECRET`

### Supabase

1. Go to https://supabase.com/dashboard/project/ivhfuhxorppptyuofbgq/settings/api
2. Copy:
   - `URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

### Twilio (Optional)

1. Go to https://console.twilio.com
2. Copy:
   - Account SID → `TWILIO_ACCOUNT_SID`
   - Auth Token → `TWILIO_AUTH_TOKEN`
3. Get a phone number → `TWILIO_PHONE_NUMBER`

### Cal.com (Optional)

1. Go to https://app.cal.com/settings/developer/api-keys
2. Create API key → `CALCOM_API_KEY`
3. Get your event type ID → `CALCOM_EVENT_TYPE_ID`

### OpenAI (Optional - if using GPT-4o)

1. Go to https://platform.openai.com/api-keys
2. Create API key → `OPENAI_API_KEY`

### ElevenLabs (Optional - for voice cloning)

1. Go to https://elevenlabs.io/api
2. Copy API key → `ELEVENLABS_API_KEY`

## Step 3: Configure Environment Variables

Update `.env.local` with your keys:

```bash
# Vapi.ai
VAPI_API_KEY=sk_live_...
VAPI_WEBHOOK_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://ivhfuhxorppptyuofbgq.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Twilio (Optional)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Cal.com (Optional)
CALCOM_API_KEY=cal_live_...
CALCOM_EVENT_TYPE_ID=123456

# OpenAI (Optional)
OPENAI_API_KEY=sk-proj-...

# ElevenLabs (Optional)
ELEVENLABS_API_KEY=...
```

## Step 4: Test Locally

```bash
npm run dev
```

Visit http://localhost:3000 and check:
- ✅ Home page loads
- ✅ `/api/health` returns healthy status
- ✅ Dashboard loads at `/dashboard`

## Step 5: Deploy to Vercel

```bash
npx vercel --yes --prod
```

Or via Vercel Dashboard:
1. Import repository
2. Set environment variables (same as `.env.local`)
3. Deploy

## Step 6: Configure Vapi Webhooks

After deployment, you'll have a URL like `https://voice-ai-agent.vercel.app`

1. Go to Vapi dashboard → Settings → Webhooks
2. Set webhook URL to: `https://your-domain.vercel.app/api/webhooks/vapi`
3. Set webhook secret (same as `VAPI_WEBHOOK_SECRET`)
4. Enable events:
   - `call.started`
   - `call.ended`
   - `function-call`
   - `transcript`
   - `status-update`

## Step 7: Create Your First Assistant

### Via Dashboard

1. Go to `https://your-domain.vercel.app/dashboard`
2. Click "Create New Assistant"
3. Configure:
   - Name: "Sales Assistant"
   - Model: GPT-4o or Claude Sonnet
   - Voice: ElevenLabs (pick a voice ID)
   - First Message: "Hi! Thanks for calling..."
   - Function Tools: Enable booking, SMS, lookup

### Via API

```bash
curl -X POST https://your-domain.vercel.app/api/vapi/assistant \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Assistant",
    "model": {
      "provider": "openai",
      "model": "gpt-4o",
      "systemPrompt": "You are a friendly sales assistant...",
      "temperature": 0.7
    },
    "voice": {
      "provider": "elevenlabs",
      "voiceId": "21m00Tcm4TlvDq8ikWAM"
    },
    "firstMessage": "Hi! Thanks for calling. How can I help you today?",
    "recordingEnabled": true,
    "serverUrl": "https://your-domain.vercel.app/api/webhooks/vapi",
    "serverUrlSecret": "your_webhook_secret"
  }'
```

## Step 8: Test a Call

### Option A: Inbound Call via Vapi Phone Number

1. Buy a phone number in Vapi dashboard
2. Assign it to your assistant
3. Call the number from your phone

### Option B: Outbound Call via API

```bash
curl -X POST https://your-domain.vercel.app/api/calls \
  -H "Content-Type: application/json" \
  -d '{
    "assistantId": "your_assistant_id",
    "phoneNumber": "your_vapi_phone_number_id",
    "customerNumber": "+1234567890"
  }'
```

## Verification Checklist

- [ ] Database tables created in Supabase
- [ ] `/api/health` returns all services as "ok"
- [ ] Assistant created successfully
- [ ] Test call completes
- [ ] Call logged in `voice_agent_calls` table
- [ ] Transcript saved in `voice_agent_transcripts` table
- [ ] Function calls logged in `voice_agent_function_calls` table
- [ ] SMS sent successfully (if configured)
- [ ] Appointment booked on Cal.com (if configured)

## Troubleshooting

### Webhook not receiving events

- Check Vapi webhook URL is correct
- Verify `VAPI_WEBHOOK_SECRET` matches Vapi dashboard
- Check Vercel function logs

### Database connection fails

- Verify Supabase credentials in env vars
- Check RLS policies allow service role access
- Test connection: `curl https://your-domain.vercel.app/api/health`

### Function calls failing

- Ensure Cal.com/Twilio keys are correct
- Check function logs in Supabase `voice_agent_function_calls` table
- Verify webhook handler is processing `function-call` events

## Vercel Deployment Configuration

### Preview Deployments (F1321)

Vercel automatically creates preview deployments for all pull requests:

1. Every PR gets a unique URL: `https://voice-ai-agent-{pr-id}.vercel.app`
2. Preview URLs are posted as PR comments
3. Use preview URLs for testing before merging

### Custom Domain Setup (F1322)

Configure a custom domain in Vercel dashboard:

```bash
# Add domain via Vercel CLI
vercel domains add yourdomain.com

# Or via dashboard:
# 1. Go to Project Settings → Domains
# 2. Add your domain
# 3. Configure DNS records as instructed
```

### Continuous Deployment (F1330)

Production deployment is automatic on merge to main:

```bash
# 1. Merge PR to main
git checkout main
git pull origin main

# 2. Vercel auto-deploys to production
# Monitor at: https://vercel.com/your-team/voice-ai-agent/deployments
```

### Deployment Health Checks & Rollback (F1332)

Vercel runs health checks after deployment:

1. Health check endpoint: `/api/health`
2. On failure (3 consecutive checks), Vercel rolls back automatically
3. Configure in `vercel.json`:

```json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/next"
    }
  ],
  "checks": {
    "path": "/api/health",
    "initialDelay": 10000,
    "interval": 30000,
    "timeout": 15000,
    "retries": 3
  }
}
```

Manual rollback:

```bash
# Via CLI
vercel rollback

# Via dashboard
# Go to Deployments → Select previous deployment → Promote to Production
```

## Webhook Registration

### Cal.com Webhook Setup (F1326)

Register webhook in Cal.com dashboard:

1. Go to https://app.cal.com/settings/developer/webhooks
2. Click "Add Webhook"
3. Configure:
   - **Subscriber URL**: `https://your-domain.vercel.app/api/webhooks/calcom`
   - **Events**: booking.created, booking.rescheduled, booking.cancelled
   - **Secret**: (copy to `CALCOM_WEBHOOK_SECRET` env var)
4. Click "Save"

Verify webhook:

```bash
curl -X POST https://your-domain.vercel.app/api/webhooks/calcom \
  -H "Content-Type: application/json" \
  -H "X-Cal-Signature: test" \
  -d '{"triggerEvent": "BOOKING_CREATED", "payload": {}}'
```

### Vapi Webhook Setup

Register webhook in Vapi dashboard:

1. Go to https://dashboard.vapi.ai/webhooks
2. Add webhook URL: `https://your-domain.vercel.app/api/webhooks/vapi`
3. Select events: call.started, call.ended, function.called
4. Save webhook secret as `VAPI_WEBHOOK_SECRET`

### Twilio Webhook Setup

Configure Twilio phone number webhook:

1. Go to Twilio Console → Phone Numbers
2. Select your number
3. Set webhook URLs:
   - **Voice**: `https://your-domain.vercel.app/api/webhooks/twilio`
   - **SMS Status**: `https://your-domain.vercel.app/api/webhooks/twilio/sms-status`
4. Save

## Monitoring & Alerting

### Uptime Monitoring (F1336)

Configure external uptime monitoring on `/api/health`:

**Option A: Using Vercel Analytics**

```bash
# Enable in vercel.json
{
  "monitoring": {
    "uptime": {
      "enabled": true,
      "path": "/api/health",
      "interval": 60000
    }
  }
}
```

**Option B: Using UptimeRobot**

1. Sign up at https://uptimerobot.com
2. Add Monitor:
   - Type: HTTP(S)
   - URL: `https://your-domain.vercel.app/api/health`
   - Interval: 5 minutes
3. Configure alerts: 3 consecutive failures
4. Add email/Slack notification

**Option C: Using Checkly**

```javascript
// checkly.config.js
const { ChecklyConfig } = require('checkly')

module.exports = new ChecklyConfig({
  checks: {
    frequency: 5,
    locations: ['us-east-1', 'eu-west-1'],
  },
})

// checks/health-check.check.js
const { ApiCheck } = require('checkly/constructs')

new ApiCheck('health-check-1', {
  name: 'Health Check',
  request: {
    url: 'https://your-domain.vercel.app/api/health',
    method: 'GET',
  },
  maxResponseTime: 5000,
  runParallel: true,
  alertChannels: [emailChannel],
})
```

### Error Rate Monitoring (F1337)

Configure error rate alerting (>5% in 5 minutes):

**Using Vercel Log Drains**

```bash
# Configure log drain to monitoring service
vercel log-drain add https://your-log-service.com/ingest \
  --project voice-ai-agent \
  --token YOUR_TOKEN
```

**Using built-in error tracking**

See `lib/error-rate-alerting.ts` - runs every 5 minutes:

```bash
# Schedule with Vercel Cron
# In vercel.json:
{
  "crons": [
    {
      "path": "/api/monitoring/error-rate",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Create endpoint `/api/monitoring/error-rate/route.ts`:

```typescript
import { monitorErrorRates } from '@/lib/error-rate-alerting'

export async function GET() {
  const stats = await monitorErrorRates()
  return Response.json({ stats })
}
```

### Response Time Monitoring (F1338)

Configure latency alerting (p95 > 2s):

**Using Vercel Analytics**

```bash
# View latency in Vercel dashboard:
# Analytics → Performance → p95 Response Time
```

**Custom implementation**

```typescript
// middleware.ts
import { NextResponse } from 'next/server'

export function middleware(request: Request) {
  const start = Date.now()

  const response = NextResponse.next()

  response.headers.set('X-Response-Time', `${Date.now() - start}ms`)

  // Log slow requests
  const duration = Date.now() - start
  if (duration > 2000) {
    console.warn(`Slow request: ${request.url} took ${duration}ms`)
    // Send to monitoring service
  }

  return response
}
```

**Alert configuration**

Set up alerts in monitoring dashboard:
- Metric: p95 response time
- Threshold: > 2000ms
- Window: 5 minutes
- Alert channels: Email, Slack

## Multi-Tenant Setup Guide (Feature 144)

### Overview

The Voice AI Agent supports multi-tenancy, allowing a single deployment to serve multiple businesses/clients. Each tenant has:

- **Isolated data**: Calls, contacts, campaigns, KB, caller memory
- **Separate phone numbers**: Each tenant owns specific phone numbers
- **Custom configuration**: Assistant ID, persona, voice, system prompt, business hours
- **API key authentication**: Tenant-scoped API access

### Step 1: Enable Multi-Tenant Tables

Apply the multi-tenant migration (if not already done):

```bash
# Via Supabase CLI
supabase db push

# Or manually run migration file:
# supabase/migrations/00X_multi_tenant.sql
```

Verify tables exist:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('tenants', 'tenant_configs', 'tenant_api_keys');
```

### Step 2: Create Your First Tenant

**Via API:**

```bash
curl -X POST https://your-domain.vercel.app/api/tenants \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme-corp",
    "phone_numbers": ["+15551234567", "+15559876543"],
    "plan": "pro",
    "settings": {
      "feature_flags": {
        "advanced_routing": true,
        "sentiment_analysis": true
      }
    }
  }'
```

**Response:**

```json
{
  "id": "tenant_abc123",
  "name": "Acme Corp",
  "slug": "acme-corp",
  "phone_numbers": ["+15551234567", "+15559876543"],
  "plan": "pro",
  "created_at": "2026-04-04T10:00:00Z"
}
```

### Step 3: Configure Tenant Settings

Create tenant config:

```bash
curl -X POST https://your-domain.vercel.app/api/tenants/tenant_abc123/config \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "kb_namespace": "acme-corp-kb",
    "assistant_id": "asst_acme_123",
    "persona_name": "Acme Sales Bot",
    "voice_id": "21m00Tcm4TlvDq8ikWAM",
    "system_prompt": "You are a friendly sales assistant for Acme Corp. Help customers with product inquiries and schedule demos.",
    "timezone": "America/New_York",
    "business_hours": {
      "monday": { "open": "09:00", "close": "17:00" },
      "tuesday": { "open": "09:00", "close": "17:00" },
      "wednesday": { "open": "09:00", "close": "17:00" },
      "thursday": { "open": "09:00", "close": "17:00" },
      "friday": { "open": "09:00", "close": "17:00" }
    }
  }'
```

### Step 4: Generate Tenant API Key

Create API key for tenant-scoped access:

```bash
curl -X POST https://your-domain.vercel.app/api/tenants/tenant_abc123/api-keys \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "name": "Production API Key",
    "scopes": ["calls:read", "calls:write", "contacts:read", "contacts:write", "kb:read"]
  }'
```

**Response:**

```json
{
  "id": "key_xyz789",
  "key": "vaa_tenant_acme-corp_a1b2c3d4e5f6...",
  "name": "Production API Key",
  "scopes": ["calls:read", "calls:write", "contacts:read", "contacts:write", "kb:read"],
  "created_at": "2026-04-04T10:05:00Z"
}
```

⚠️ **IMPORTANT**: Save the `key` value securely. It will only be shown once.

### Step 5: Assign Phone Numbers

Phone numbers are matched to tenants automatically based on the `phone_numbers` array in the tenant record.

**Add phone number to existing tenant:**

```bash
curl -X POST https://your-domain.vercel.app/api/tenants/tenant_abc123/phone-numbers \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "phone_number": "+15552223333"
  }'
```

**Phone routing flow:**

1. Incoming call arrives at `+15551234567`
2. System queries `tenants` table: `WHERE phone_numbers @> ['+15551234567']`
3. Resolves to `tenant_abc123`
4. Loads `tenant_configs` for that tenant
5. Uses tenant's `assistant_id`, `voice_id`, `system_prompt`
6. All call data saved with `tenant_id = 'tenant_abc123'`

### Step 6: Upload Tenant-Specific Knowledge Base

Each tenant has an isolated KB namespace:

```bash
curl -X POST https://your-domain.vercel.app/api/kb/upload \
  -H "x-tenant-api-key: vaa_tenant_acme-corp_a1b2c3d4..." \
  -F "file=@acme-product-docs.pdf" \
  -F "title=Acme Product Documentation"
```

Knowledge base documents are automatically scoped to `tenant_id`.

### Step 7: Test Tenant Isolation

**Test 1: Create contact for Tenant A**

```bash
curl -X POST https://your-domain.vercel.app/api/contacts \
  -H "x-tenant-api-key: TENANT_A_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "John Doe",
    "phone_number": "+15551111111",
    "email": "john@tenanta.com"
  }'
```

**Test 2: Try to access from Tenant B (should fail)**

```bash
curl -X GET https://your-domain.vercel.app/api/contacts \
  -H "x-tenant-api-key: TENANT_B_API_KEY"
```

Response should NOT include John Doe (Tenant A's contact).

**Test 3: Verify call data isolation**

Make calls to both tenants' phone numbers, then query:

```bash
# Tenant A calls
curl -X GET https://your-domain.vercel.app/api/calls \
  -H "x-tenant-api-key: TENANT_A_API_KEY"

# Tenant B calls
curl -X GET https://your-domain.vercel.app/api/calls \
  -H "x-tenant-api-key: TENANT_B_API_KEY"
```

Verify zero overlap in call IDs.

### Step 8: Onboard New Tenant (Full Flow)

Use the onboarding endpoint for complete tenant setup:

```bash
curl -X POST https://your-domain.vercel.app/api/tenants/tenant_abc123/onboard \
  -H "Content-Type: application/json" \
  -H "x-admin-api-key: YOUR_ADMIN_KEY" \
  -d '{
    "vapi_assistant_id": "asst_new_tenant",
    "vapi_phone_number_id": "ph_123456",
    "voice_id": "elevenlabs_voice_id",
    "system_prompt": "You are a helpful assistant for NewCo.",
    "business_hours": {
      "monday": { "open": "08:00", "close": "18:00" },
      "tuesday": { "open": "08:00", "close": "18:00" },
      "wednesday": { "open": "08:00", "close": "18:00" },
      "thursday": { "open": "08:00", "close": "18:00" },
      "friday": { "open": "08:00", "close": "18:00" }
    }
  }'
```

This endpoint:
1. Creates `tenant_configs` record
2. Sets up KB namespace
3. Generates API key
4. Applies RLS policies
5. Returns full tenant context

### Multi-Tenant Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Incoming Call                      │
│                  +15551234567                        │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│          Tenant Router (lib/tenant-router.ts)       │
│  SELECT * FROM tenants                              │
│  WHERE phone_numbers @> ['+15551234567']            │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│              Tenant Context Loaded                   │
│  tenant_id: 'tenant_abc123'                         │
│  assistant_id: 'asst_acme_123'                      │
│  kb_namespace: 'acme-corp-kb'                       │
│  voice_id: '21m00Tcm4TlvDq8ikWAM'                   │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│             All Queries Scoped to Tenant            │
│  SELECT * FROM contacts WHERE tenant_id = ?         │
│  SELECT * FROM kb_documents WHERE tenant_id = ?     │
│  SELECT * FROM caller_memory WHERE tenant_id = ?    │
└─────────────────────────────────────────────────────┘
```

### Tenant Data Isolation

All tenant-scoped tables include `tenant_id` column:

- `contacts`
- `voice_agent_calls`
- `campaigns`
- `campaign_contacts`
- `kb_documents`
- `kb_embeddings`
- `caller_memory`
- `live_transcripts`
- `call_evaluations`
- `mcp_registry`

**RLS Policies (Row Level Security):**

```sql
-- Example: contacts table
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can only access their own contacts"
  ON contacts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant')::text);
```

Application code sets tenant context:

```typescript
// Before query
await supabaseAdmin.rpc('set_config', {
  key: 'app.current_tenant',
  value: tenantId,
})

// Now queries are automatically scoped
const { data } = await supabaseAdmin.from('contacts').select('*')
// Returns only contacts for current tenant
```

### Monitoring Multi-Tenant Health

**Dashboard per-tenant metrics:**

```bash
curl -X GET https://your-domain.vercel.app/api/tenants/tenant_abc123/stats \
  -H "x-admin-api-key: YOUR_ADMIN_KEY"
```

**Response:**

```json
{
  "tenant_id": "tenant_abc123",
  "calls_today": 47,
  "calls_this_month": 1203,
  "avg_call_duration": 145,
  "bookings_made": 89,
  "contacts_count": 456,
  "kb_documents_count": 12,
  "active_campaigns": 3
}
```

### Troubleshooting Multi-Tenant Issues

**Issue: Call not routing to correct tenant**

Check phone number format:

```sql
-- Debug query
SELECT id, name, phone_numbers
FROM tenants
WHERE phone_numbers @> ['+15551234567'];
```

Ensure phone number is in E.164 format (+1...) with no spaces/dashes.

**Issue: Cross-tenant data leak**

Verify all queries use `TenantQueryBuilder`:

```typescript
// ❌ BAD - not tenant-scoped
const { data } = await supabaseAdmin.from('contacts').select('*')

// ✅ GOOD - tenant-scoped
const query = new TenantQueryBuilder(tenantId)
const { data } = await query.scopeContacts()
```

**Issue: API key auth failing**

Check key format and hash:

```sql
-- Verify API key exists
SELECT id, tenant_id, name, status
FROM tenant_api_keys
WHERE key_hash = encode(digest('vaa_tenant_...', 'sha256'), 'hex');
```

### Default Tenant Fallback

If no tenant matches the incoming phone number, the system falls back to `default` tenant:

```sql
INSERT INTO tenants (id, name, slug, phone_numbers, plan, settings)
VALUES (
  'default',
  'Default Tenant',
  'default',
  ARRAY[]::text[],
  'free',
  '{}'::jsonb
);
```

## Next Steps

- Create additional assistants for different use cases
- Set up outbound calling campaigns
- Build analytics dashboard
- Implement A/B testing for prompts
- Add sentiment analysis
- Create voicemail detection and drop

---

## Easy!Appointments Self-Hosting (Feature 227)

Easy!Appointments is a self-hosted scheduling system included as an alternative to Cal.com and Google Calendar. This guide covers deploying the Easy!Appointments Docker stack alongside your Voice AI Agent.

### Architecture

```
┌─────────────────────────────────────────────┐
│  Voice AI Agent (Next.js)                   │
│  - API Routes: /api/scheduling/*            │
│  - Scheduling Provider: EasyAppointmentsProvider
│  - Port: 3000                               │
└────────────────┬────────────────────────────┘
                 │
                 │ HTTP API (localhost:8080)
                 ▼
┌─────────────────────────────────────────────┐
│  Easy!Appointments (Docker)                 │
│  - Web UI: http://localhost:8080            │
│  - API: /index.php/api/v1/*                 │
│  - Port: 8080                               │
└────────────────┬────────────────────────────┘
                 │
                 │ MySQL Protocol
                 ▼
┌─────────────────────────────────────────────┐
│  MySQL 8.0 (Docker)                         │
│  - Database: easyappointments               │
│  - User: easyappointments                   │
│  - Port: 3306 (internal only)               │
└─────────────────────────────────────────────┘
```

---

### Quick Start

#### 1. Start Docker Stack

```bash
cd /path/to/voice-ai-agent
cd docker/easyappointments

# Start services
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs
docker-compose logs -f
```

Expected output:
```
NAME                        IMAGE                                    STATUS
easyappointments-app        easyappointments/easyappointments:latest Up 30 seconds
easyappointments-mysql      mysql:8.0                                Up 30 seconds (healthy)
```

#### 2. Complete Installation Wizard

1. Open browser to: **http://localhost:8080**
2. Follow the installation wizard:
   - **Database Settings** (pre-configured in docker-compose.yml):
     - Host: `mysql`
     - Database: `easyappointments`
     - Username: `easyappointments`
     - Password: `easyappointments_password_change_me`
   - **Admin Account**:
     - Email: your admin email
     - Password: choose a strong password
   - **Company Info**: fill in your business details

3. Click **Install** and wait for completion

#### 3. Enable API Access

After installation:

1. Log in to Easy!Appointments
2. Navigate to **Settings** → **API** (top menu)
3. Toggle **Enable API** to ON
4. Click **Generate API Key**
5. **Copy the API key** — you'll need it for the Voice AI Agent

#### 4. Configure Voice AI Agent

Update your `.env` file:

```bash
# Switch to Easy!Appointments provider
SCHEDULING_PROVIDER=easyappointments

# Easy!Appointments Configuration
EASYAPPOINTMENTS_API_URL=http://localhost:8080
EASYAPPOINTMENTS_API_KEY=your_generated_api_key_here
EASYAPPOINTMENTS_SERVICE_ID=1  # Get from Settings → Services
```

#### 5. Restart Voice AI Agent

```bash
# If running locally
npm run dev

# If running in production
pm2 restart voice-ai-agent

# Or Docker
docker-compose restart
```

#### 6. Verify Integration

Visit the scheduling dashboard:
```
http://localhost:3000/dashboard/scheduling
```

You should see:
- **Active Provider**: Easy!Appointments
- **Status**: Configured (green)
- **Health**: Healthy

---

### Configuration

#### Add a Service

Services define the types of appointments you offer:

1. Go to **Settings** → **Services**
2. Click **Add Service**
3. Configure:
   - **Name**: "30-Minute Consultation"
   - **Duration**: 30 minutes
   - **Price**: $0 (optional)
   - **Description**: "Initial consultation call"
4. Click **Save**
5. Note the **Service ID** (visible in URL or API)

Update `.env` with the service ID:
```bash
EASYAPPOINTMENTS_SERVICE_ID=1
```

#### Add Providers (Staff)

Providers are staff members who perform appointments:

1. Go to **Settings** → **Users** → **Providers**
2. Click **Add Provider**
3. Configure:
   - **Name**: Staff member's name
   - **Email/Phone**: Contact details
   - **Services**: Assign services this provider offers
   - **Working Plan**: Set availability hours
4. Click **Save**

#### Set Working Hours

Define when appointments can be booked:

1. Edit a provider
2. Go to **Working Plan** tab
3. For each day of the week:
   - **Start**: 09:00
   - **End**: 17:00
   - **Breaks**: Add lunch breaks (e.g., 12:00-13:00)
   - **Disable**: Check to mark day as unavailable
4. Click **Save**

---

### Production Deployment

#### Security Hardening

**1. Change Default Passwords**

Edit `docker-compose.yml` BEFORE first run:

```yaml
environment:
  MYSQL_ROOT_PASSWORD: your_secure_root_password_here
  MYSQL_PASSWORD: your_secure_app_password_here
```

**2. Use Strong API Key**

Regenerate API key after installation:
- Settings → API → Regenerate API Key
- Update `.env` with new key

**3. Enable HTTPS**

Use Nginx reverse proxy:

```nginx
server {
    listen 443 ssl http2;
    server_name appointments.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Update `docker-compose.yml`:
```yaml
environment:
  BASE_URL: https://appointments.yourdomain.com
```

**4. Restrict API Access**

Add IP whitelist in Nginx:

```nginx
location /index.php/api/ {
    allow 10.0.0.0/24;  # Your Voice AI Agent's IP
    deny all;

    proxy_pass http://localhost:8080;
}
```

**5. Set Up Firewall**

```bash
# Allow only HTTPS (443) and SSH (22)
ufw allow 22/tcp
ufw allow 443/tcp
ufw enable

# Block direct access to port 8080
ufw deny 8080/tcp
```

#### Email Notifications

Configure SMTP for appointment confirmations:

**Gmail Example**

1. Create App Password: https://support.google.com/accounts/answer/185833

2. Edit `docker-compose.yml`:
```yaml
environment:
  SMTP_HOST: smtp.gmail.com
  SMTP_PORT: 587
  SMTP_CRYPTO: tls
  SMTP_USER: your-email@gmail.com
  SMTP_PASS: your-app-password
```

3. Restart:
```bash
docker-compose restart
```

**SendGrid / AWS SES**

```yaml
# SendGrid
SMTP_HOST: smtp.sendgrid.net
SMTP_PORT: 587
SMTP_USER: apikey
SMTP_PASS: your_sendgrid_api_key

# AWS SES
SMTP_HOST: email-smtp.us-east-1.amazonaws.com
SMTP_PORT: 587
SMTP_USER: your_smtp_username
SMTP_PASS: your_smtp_password
```

---

### Backup & Restore

#### Automated Daily Backups

Create backup script:

```bash
#!/bin/bash
# /path/to/voice-ai-agent/docker/easyappointments/backup.sh

BACKUP_DIR="/backups/easyappointments"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup MySQL database
docker exec easyappointments-mysql mysqldump \
  -u easyappointments \
  -peasyappointments_password_change_me \
  easyappointments \
  > "$BACKUP_DIR/db_$DATE.sql"

# Compress backup
gzip "$BACKUP_DIR/db_$DATE.sql"

# Delete backups older than 30 days
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete

echo "Backup completed: $BACKUP_DIR/db_$DATE.sql.gz"
```

Make executable and add to cron:

```bash
chmod +x backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /path/to/backup.sh >> /var/log/easyappointments-backup.log 2>&1
```

#### Manual Backup

```bash
# Backup
docker exec easyappointments-mysql mysqldump \
  -u easyappointments \
  -peasyappointments_password_change_me \
  easyappointments > backup.sql

# Compress
gzip backup.sql
```

#### Restore from Backup

```bash
# Decompress
gunzip backup.sql.gz

# Restore
docker exec -i easyappointments-mysql mysql \
  -u easyappointments \
  -peasyappointments_password_change_me \
  easyappointments < backup.sql

# Restart app
docker-compose restart easyappointments
```

---

### Monitoring

#### Health Checks

**Application Health**

```bash
# HTTP endpoint
curl -f http://localhost:8080/index.php || echo "App down"

# Docker health status
docker inspect --format='{{.State.Health.Status}}' easyappointments-app
```

**Database Health**

```bash
docker exec easyappointments-mysql mysqladmin ping -h localhost -u root -proot_password || echo "DB down"
```

**Automated Monitoring**

Add to cron (every 5 minutes):

```bash
*/5 * * * * /path/to/health-check.sh || systemctl restart docker
```

#### Logs

View real-time logs:

```bash
# All services
docker-compose logs -f

# Application only
docker-compose logs -f easyappointments

# Database only
docker-compose logs -f mysql

# Last 100 lines
docker-compose logs --tail=100
```

#### Disk Usage

Easy!Appointments database grows over time. Monitor:

```bash
# Check database size
docker exec easyappointments-mysql mysql -u root -proot_password -e \
  "SELECT table_schema AS 'Database', 
   ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'Size (MB)' 
   FROM information_schema.tables 
   WHERE table_schema = 'easyappointments' 
   GROUP BY table_schema;"

# Check Docker volume size
docker system df -v | grep easyappointments
```

---

### Troubleshooting

#### Port Conflict

If port 8080 is in use:

```yaml
# docker-compose.yml
ports:
  - "8081:80"  # Change to 8081
```

Update `.env`:
```bash
EASYAPPOINTMENTS_API_URL=http://localhost:8081
```

#### Can't Connect to Database

Check MySQL is healthy:

```bash
docker-compose logs mysql

# Verify connection
docker exec easyappointments-mysql mysql \
  -u easyappointments \
  -peasyappointments_password_change_me \
  -e "SHOW DATABASES;"
```

#### API Returns 401 Unauthorized

1. Verify API is enabled: Settings → API
2. Check API key matches `.env`
3. Verify authorization header format:
   ```
   Authorization: Bearer YOUR_API_KEY
   ```

#### Reset Admin Password

```bash
# Connect to MySQL
docker exec -it easyappointments-mysql mysql \
  -u root -proot_password easyappointments

# Update password (hashed: "newpassword")
UPDATE ea_users
SET password = '$2y$10$K7O/MV6CneZ6.V1FuT3Q1.m1r2L/H8YJ0h8qTxO3F4kF7wXYlLF2K'
WHERE id_roles = 1;

exit;
```

Log in with password: `newpassword`

#### Appointments Not Showing in Dashboard

Check integration:

```bash
# Test API connectivity
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:8080/index.php/api/v1/appointments

# Check Voice AI Agent logs
npm run dev  # or pm2 logs voice-ai-agent

# Verify provider is set correctly
cat .env | grep SCHEDULING_PROVIDER
```

---

### Scaling

#### High-Traffic Setup

For >100 bookings/day, use separate database server:

1. **External MySQL**:
   ```yaml
   # Remove mysql service from docker-compose.yml
   # Update environment:
   environment:
     DB_HOST: db.yourdomain.com
     DB_NAME: easyappointments
     DB_USERNAME: ea_user
     DB_PASSWORD: secure_password
   ```

2. **Redis Caching** (optional):
   Add Redis service for session caching.

3. **Load Balancer**:
   Run multiple Easy!Appointments instances behind Nginx.

#### Database Optimization

```sql
-- Add indexes for faster queries
CREATE INDEX idx_appointments_start_datetime ON ea_appointments(start_datetime);
CREATE INDEX idx_appointments_id_users_provider ON ea_appointments(id_users_provider);
CREATE INDEX idx_appointments_id_services ON ea_appointments(id_services);

-- Archive old appointments (>1 year)
CREATE TABLE ea_appointments_archive LIKE ea_appointments;
INSERT INTO ea_appointments_archive
  SELECT * FROM ea_appointments
  WHERE start_datetime < DATE_SUB(NOW(), INTERVAL 1 YEAR);

DELETE FROM ea_appointments
  WHERE start_datetime < DATE_SUB(NOW(), INTERVAL 1 YEAR);
```

---

### Uninstall

```bash
# Stop services
docker-compose down

# Remove all data (WARNING: irreversible!)
docker-compose down -v

# Remove images
docker rmi easyappointments/easyappointments:latest mysql:8.0
```

---

### Resources

- **Full Setup Guide**: `docker/easyappointments/README.md`
- **Official Docs**: https://docs.easyappointments.org/
- **API Reference**: https://easyappointments.org/docs/api/
- **GitHub**: https://github.com/alextselegidis/easyappointments
- **Docker Hub**: https://hub.docker.com/r/easyappointments/easyappointments

