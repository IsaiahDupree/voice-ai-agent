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

## Next Steps

- Create additional assistants for different use cases
- Set up outbound calling campaigns
- Build analytics dashboard
- Implement A/B testing for prompts
- Add sentiment analysis
- Create voicemail detection and drop
