# Cal.com Webhook Setup Guide

## Overview

Cal.com handles appointment scheduling for your voice AI agent. This guide covers:
1. Cal.com account setup
2. API key generation
3. Event type configuration
4. Webhook setup for booking confirmations

## Prerequisites

- Cal.com account (free or paid plan)
- Access to Cal.com dashboard: https://cal.com
- Access to your Voice AI Agent deployment

## Step 1: Create Cal.com Account

### Option A: Cal.com Cloud (Recommended)

1. Visit https://cal.com/signup
2. Sign up with email or OAuth (Google/GitHub)
3. Complete onboarding:
   - Set your username (e.g., `john-acme`)
   - Connect your calendar (Google Calendar, Outlook, etc.)
   - Set your availability

### Option B: Self-Hosted

If you need full control or custom domain:

```bash
git clone https://github.com/calcom/cal.com
cd cal.com
cp .env.example .env
# Configure .env with database URL, etc.
yarn install
yarn dev
```

**Recommendation:** Use Cal.com Cloud unless you have specific security requirements.

## Step 2: Generate API Key

1. **Log in to Cal.com**: https://app.cal.com
2. **Navigate to Settings** → **Security** → **API Keys**
3. Click **"New API Key"**
4. Name: `Voice AI Agent`
5. Expiration: Never (or set date)
6. Permissions: Select all (or minimum: `READ`, `WRITE` bookings)
7. Click **Generate**
8. **Copy API key** (shown only once!)

**Save to environment variables:**

```bash
# .env.local
CAL_COM_API_KEY=cal_live_xxxxxxxxxxxxxxxxxxxxx
CAL_COM_EVENT_TYPE_ID=123456  # Set in Step 3
```

**Deploy to Vercel:**

```bash
vercel env add CAL_COM_API_KEY
# Paste API key when prompted

vercel env add CAL_COM_EVENT_TYPE_ID
# Will set after creating event type
```

## Step 3: Create Event Type

**Event Type** = a bookable appointment slot configuration (e.g., "30-Minute Discovery Call").

### Via Dashboard UI

1. **Dashboard** → **Event Types** → **New Event Type**
2. Fill in:
   - **Title**: `Discovery Call` (or your meeting type)
   - **URL**: `discovery-call` (becomes cal.com/your-name/discovery-call)
   - **Duration**: `30 minutes`
   - **Location**: Zoom, Google Meet, Phone, etc.
3. **Availability**:
   - Mon-Fri, 9am-5pm (or your hours)
   - Buffer time: 15 minutes between meetings
4. **Booking Questions** (optional):
   - Name (required)
   - Email (required)
   - Phone (optional)
   - Custom questions
5. Click **Create**

### Via API

```bash
curl -X POST "https://api.cal.com/v1/event-types" \
  -H "Authorization: Bearer $CAL_COM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Discovery Call",
    "slug": "discovery-call",
    "length": 30,
    "description": "A 30-minute call to discuss your needs",
    "locations": [
      {
        "type": "phone",
        "phone": "+15551234567"
      }
    ]
  }'
```

**Response:**
```json
{
  "event_type": {
    "id": 123456,
    "title": "Discovery Call",
    "slug": "discovery-call",
    "length": 30
  }
}
```

**Save Event Type ID:**

```bash
# Update .env.local
CAL_COM_EVENT_TYPE_ID=123456

# Deploy to Vercel
vercel env add CAL_COM_EVENT_TYPE_ID
# Enter: 123456
```

## Step 4: Configure Webhooks

Webhooks notify your app when bookings are created, rescheduled, or cancelled.

### Add Webhook in Cal.com Dashboard

1. **Settings** → **Developer** → **Webhooks**
2. Click **New Webhook**
3. Fill in:
   - **Subscriber URL**: `https://your-app.vercel.app/api/webhooks/calcom`
   - **Event Triggers**: Select:
     - `BOOKING_CREATED`
     - `BOOKING_RESCHEDULED`
     - `BOOKING_CANCELLED`
   - **Active**: ✅ Enabled
4. Click **Create**

### Verify Webhook Endpoint

Test your webhook endpoint:

```bash
curl -X POST https://your-app.vercel.app/api/webhooks/calcom \
  -H "Content-Type: application/json" \
  -d '{
    "triggerEvent": "BOOKING_CREATED",
    "createdAt": "2026-03-28T10:00:00Z",
    "payload": {
      "uid": "test-booking-123",
      "title": "Discovery Call",
      "startTime": "2026-03-29T14:00:00Z",
      "endTime": "2026-03-29T14:30:00Z",
      "attendees": [
        {
          "email": "john@example.com",
          "name": "John Doe",
          "timeZone": "America/New_York"
        }
      ]
    }
  }'
```

**Expected response:** `200 OK`

If you get an error, check:
- Webhook handler exists at `/api/webhooks/calcom/route.ts`
- Vercel deployment is live
- No CORS issues (webhooks don't follow CORS)

## Step 5: Test End-to-End

### 1. Make a Test Call

```bash
curl -X POST https://your-app.vercel.app/api/calls/outbound \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+15551234567",  # Your test number
    "persona_id": 1
  }'
```

### 2. During Call

Say to the agent:
```
"I'd like to book an appointment for tomorrow at 2 PM."
```

Agent should:
1. Call `checkCalendar` tool (verify availability)
2. Confirm: "I have 2 PM available tomorrow. Shall I book that for you?"
3. You confirm: "Yes, please."
4. Call `bookAppointment` tool
5. Confirm: "Great! I've booked you for 2 PM tomorrow. You'll receive a confirmation email."

### 3. Verify Booking

**Check Cal.com dashboard:**
1. Dashboard → Bookings
2. Should see new booking with correct date/time

**Check database:**
```bash
curl "https://your-app.vercel.app/api/bookings?call_id=CALL_ID" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected response:**
```json
{
  "bookings": [
    {
      "id": 1,
      "calcom_uid": "abc123",
      "start_time": "2026-03-29T14:00:00Z",
      "end_time": "2026-03-29T14:30:00Z",
      "status": "confirmed"
    }
  ]
}
```

### 4. Verify Webhook Received

**Check webhook logs:**
```bash
curl "https://your-app.vercel.app/api/webhooks/logs?endpoint=/api/webhooks/calcom&limit=10" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Expected:**
```json
[
  {
    "endpoint": "/api/webhooks/calcom",
    "method": "POST",
    "payload": {
      "triggerEvent": "BOOKING_CREATED",
      "payload": {...}
    },
    "response_status": 200,
    "created_at": "2026-03-28T10:05:23Z"
  }
]
```

## Advanced Configuration

### Custom Availability Rules

**Scenario:** Only allow bookings 24 hours in advance.

**Cal.com setting:**
1. Event Type → Advanced
2. **Minimum notice**: 24 hours
3. **Save**

**Scenario:** Block specific dates (holidays, vacations).

**Cal.com setting:**
1. Dashboard → Availability
2. **Date Overrides** → Add date range
3. Mark as "Unavailable"

### Multiple Event Types

For different meeting types (15-min, 30-min, 60-min):

1. Create multiple event types in Cal.com
2. Add IDs to `.env.local`:
   ```bash
   CAL_COM_EVENT_TYPE_ID_SHORT=123  # 15-min
   CAL_COM_EVENT_TYPE_ID_STANDARD=456  # 30-min
   CAL_COM_EVENT_TYPE_ID_LONG=789  # 60-min
   ```
3. Update persona system prompt:
   ```
   If caller needs a quick call, use event type 123.
   If caller needs standard discovery, use event type 456.
   If caller needs in-depth consultation, use event type 789.
   ```

### Round-Robin Booking

**Scenario:** Distribute bookings across multiple team members.

**Cal.com feature:**
1. Create a **Team**
2. Add team members
3. Create **Round-Robin Event Type**
4. Set distribution: Equal, Priority, or Manual

**Voice AI integration:**
- Use team event type ID
- Cal.com automatically assigns to next available team member

### Buffer Time

Add padding between meetings to avoid back-to-back calls.

**Cal.com setting:**
1. Event Type → Advanced
2. **Before event**: 10 minutes
3. **After event**: 5 minutes
4. **Save**

**Effect:**
- If meeting is 2:00-2:30 PM
- Actual blocked time: 1:50-2:35 PM (10 min before + 5 min after)

## Troubleshooting

### "No availability found"

**Diagnosis:**
```bash
# Test Cal.com API directly
curl -X GET "https://api.cal.com/v1/availability?eventTypeId=$CAL_COM_EVENT_TYPE_ID&startTime=2026-03-29T00:00:00Z&endTime=2026-03-29T23:59:59Z" \
  -H "Authorization: Bearer $CAL_COM_API_KEY"
```

**Solutions:**

| Cause | Solution |
|-------|----------|
| Calendar not connected | Settings → Calendars → Connect |
| No availability set | Dashboard → Availability → Set hours |
| Event type wrong | Verify `CAL_COM_EVENT_TYPE_ID` matches |
| Timezone mismatch | Check timezone in API request |

### "Booking created but not confirmed"

**Check:**
1. Webhook received? (Check `/api/webhooks/logs`)
2. Webhook processed? (Check `webhook_logs` table in Supabase)
3. Booking saved? (Check `bookings` table)

**If webhook not received:**
- Verify webhook URL in Cal.com settings
- Check Vercel logs for errors:
  ```bash
  vercel logs --since 1h | grep "/api/webhooks/calcom"
  ```

### "Double bookings"

**Cause:** Webhook received twice (not idempotent).

**Solution:**
```javascript
// In /api/webhooks/calcom/route.ts
const idempotencyKey = req.headers['x-cal-uid'] || payload.uid;

// Check if already processed
const existing = await db.query('SELECT * FROM webhook_logs WHERE idempotency_key = $1', [idempotencyKey]);
if (existing.rows.length > 0) {
  return Response.json({ message: 'Already processed' }, { status: 200 });
}

// Process booking...

// Log webhook
await db.query('INSERT INTO webhook_logs (idempotency_key, payload, ...) VALUES ($1, $2, ...)', [idempotencyKey, payload]);
```

### "Wrong timezone"

**Symptom:** Booking created for 2 PM but shows as 6 PM in calendar.

**Cause:** Timezone not passed correctly to Cal.com API.

**Solution:**
```javascript
// In bookAppointment tool
const booking = await calcom.createBooking({
  eventTypeId: process.env.CAL_COM_EVENT_TYPE_ID,
  start: '2026-03-29T14:00:00',  // Don't include Z
  timeZone: 'America/New_York',  // Caller's timezone
  ...
});
```

## Security Best Practices

### Webhook Verification

**Add signature verification** to prevent fake webhooks:

```javascript
// In /api/webhooks/calcom/route.ts
import crypto from 'crypto';

export async function POST(req: Request) {
  const signature = req.headers['x-cal-signature'];
  const body = await req.text();

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.CAL_COM_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Process webhook...
}
```

**Get webhook secret:**
1. Cal.com → Settings → Webhooks → [Your Webhook]
2. Copy **Secret**
3. Add to `.env.local`:
   ```bash
   CAL_COM_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

### API Key Rotation

**Rotate API keys quarterly:**

1. Generate new API key in Cal.com
2. Update Vercel env vars:
   ```bash
   vercel env rm CAL_COM_API_KEY
   vercel env add CAL_COM_API_KEY
   # Enter new key
   ```
3. Redeploy:
   ```bash
   vercel --prod
   ```
4. Delete old API key in Cal.com

## Monitoring

### Key Metrics

**1. Booking success rate:**
```sql
SELECT
  COUNT(*) FILTER (WHERE outcome = 'booking_made') AS successful_bookings,
  COUNT(*) AS total_calls,
  ROUND((COUNT(*) FILTER (WHERE outcome = 'booking_made')::DECIMAL / COUNT(*)) * 100, 2) AS booking_rate
FROM voice_agent_calls
WHERE created_at > NOW() - INTERVAL '7 days';
```

**Target:** 15-25% booking rate (varies by industry)

**2. Webhook delivery rate:**
```sql
SELECT
  COUNT(*) AS webhooks_received,
  COUNT(DISTINCT booking_id) AS unique_bookings
FROM webhook_logs
WHERE endpoint = '/api/webhooks/calcom'
AND created_at > NOW() - INTERVAL '7 days';
```

**Target:** 100% (every booking should trigger webhook)

**3. No-show rate:**
```sql
SELECT
  COUNT(*) FILTER (WHERE status = 'no_show') AS no_shows,
  COUNT(*) AS total_bookings,
  ROUND((COUNT(*) FILTER (WHERE status = 'no_show')::DECIMAL / COUNT(*)) * 100, 2) AS no_show_rate
FROM bookings
WHERE start_time > NOW() - INTERVAL '7 days';
```

**Target:** < 20% no-show rate

## Cost Optimization

### Cal.com Pricing

| Plan | Cost | Calendars | Event Types | Team Members |
|------|------|-----------|-------------|--------------|
| Free | $0/mo | 1 | Unlimited | 1 |
| Pro | $15/mo | Unlimited | Unlimited | 1 |
| Team | $30/mo/seat | Unlimited | Unlimited | Unlimited |

**For most use cases:** Free plan is sufficient.

**Upgrade to Pro if:**
- Need multiple calendars (personal + work)
- Need custom branding
- Need advanced features (round-robin, webhooks per event type)

**Upgrade to Team if:**
- Multiple sales reps or support agents
- Need round-robin distribution
- Need team analytics

## Next Steps

- [Persona Builder Guide](./PERSONA-GUIDE.md) - Configure personas to use Cal.com tools
- [Campaign Setup Guide](./CAMPAIGN-GUIDE.md) - Launch booking campaigns
- [Troubleshooting](./TROUBLESHOOTING.md) - Fix booking issues

## Resources

- **Cal.com Dashboard**: https://app.cal.com
- **API Docs**: https://cal.com/docs/api-reference
- **Webhook Docs**: https://cal.com/docs/webhooks
- **Support**: https://cal.com/support
