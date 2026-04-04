# Test Credentials & Environment Setup

## Overview

This guide provides test credentials and safe testing practices for development and staging environments.

## Environment Variables

### Required Variables

```bash
# .env.local (local development)
# .env.test (test environment)

# === Vapi (Voice Platform) ===
VAPI_API_KEY=vapi_xxxxxxxxxxxxxxxxxxxxxxxx
# Get from: https://dashboard.vapi.ai → Settings → API Keys

# === OpenAI (LLM) ===
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Get from: https://platform.openai.com/api-keys

# === Anthropic (Alternative LLM) ===
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx
# Get from: https://console.anthropic.com/settings/keys

# === ElevenLabs (TTS) ===
ELEVENLABS_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Get from: https://elevenlabs.io/speech-synthesis → Profile → API Keys

# === Deepgram (STT) ===
DEEPGRAM_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Get from: https://console.deepgram.com/project/xxxxx/overview

# === Twilio (SMS) ===
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+15551234567
# Get from: https://console.twilio.com

# === Cal.com (Scheduling) ===
CAL_COM_API_KEY=cal_live_xxxxxxxxxxxxxxxxxxxxx
CAL_COM_EVENT_TYPE_ID=123456
# Get from: https://app.cal.com/settings/developer/api-keys

# === Supabase (Database) ===
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx
# Get from: https://app.supabase.com/project/xxxxx/settings/api

# === Next.js Public (Client-side) ===
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Test Accounts

### Development Test Numbers

**IMPORTANT: Use these numbers for testing only. They are monitored and will not disrupt real customers.**

| Purpose | Phone Number | Owner | Notes |
|---------|-------------|-------|-------|
| Primary Test | +15551234567 | Your mobile | Your personal number for testing |
| Secondary Test | +15559876543 | Team member | Secondary tester |
| Voicemail Test | +15555555555 | Voicemail service | Always goes to voicemail |
| Disconnected Test | +15551111111 | N/A | Simulates disconnected number |

**Add test numbers to contacts:**

```bash
curl -X POST https://your-app.vercel.app/api/contacts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Test User",
    "phone_number": "+15551234567",
    "email": "test@example.com",
    "company": "Test Corp",
    "tags": ["test"]
  }'
```

### Test Email Addresses

For testing booking confirmations and email notifications:

```
test-booking@example.com
test-confirmation@example.com
dev-test@yourcompany.com
```

**Do NOT use:**
- Real customer emails
- Personal emails (will clutter inbox)
- Distribution lists

### Test Cal.com Calendar

Create a dedicated test calendar:

1. **Google Calendar**: Create calendar named "Voice AI Test"
2. **Connect to Cal.com**: Settings → Calendars → Add Calendar
3. **Create test event type**: "Test Discovery Call (30 min)"
4. **Set wide availability**: 9am-9pm, 7 days/week
5. **Use for all test bookings**

**Why separate calendar:**
- Prevents test bookings from cluttering production calendar
- Can be cleared regularly without affecting real bookings
- Easy to distinguish test vs production data

## Test API Keys

### Sandbox vs Production

Most services offer sandbox/test keys:

| Service | Test Mode | How to Enable |
|---------|-----------|---------------|
| Vapi | No sandbox (use test numbers) | Mark test calls with metadata: `{"test": true}` |
| Twilio | Test credentials available | Use `AC` test SID (starts with `AC` vs `SK`) |
| Cal.com | No sandbox (use test calendar) | Create separate event type for testing |
| Stripe | Test keys (future payments) | Use keys starting with `pk_test_` and `sk_test_` |

### Twilio Test Credentials

**Test SID:** `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (fake)
**Test Auth Token:** `your_auth_token` (fake)

**Magic test numbers:**
- `+15005550006` - Valid number, success
- `+15005550001` - Invalid number, error
- `+15005550007` - Valid, goes to voicemail

**Test in development:**
```bash
# .env.test
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxx  # Test SID
TWILIO_AUTH_TOKEN=test_auth_token
TWILIO_PHONE_NUMBER=+15005550006
```

### Vapi Test Assistant

Create a dedicated test assistant:

1. Vapi Dashboard → Assistants → Create
2. Name: "Test Assistant - DO NOT DELETE"
3. Model: GPT-3.5-turbo (cheaper for testing)
4. Voice: Rachel (standard)
5. System prompt: "This is a test assistant. You are helping test the voice AI system."

**Use test assistant for:**
- Development testing
- CI/CD test runs
- Load testing

**Never use test assistant for:**
- Production campaigns
- Real customer calls

## Safe Testing Practices

### 1. Tag Test Data

Always tag test records:

```javascript
// When creating test calls
await db.insert('voice_agent_calls', {
  phone_number: '+15551234567',
  tags: ['test', 'development'],
  metadata: { test_mode: true }
});
```

**Query test data:**
```sql
-- Count test calls
SELECT COUNT(*) FROM voice_agent_calls WHERE 'test' = ANY(tags);

-- Exclude test data from reports
SELECT COUNT(*) FROM voice_agent_calls WHERE NOT ('test' = ANY(tags));
```

### 2. Use Test Mode Flag

Add test mode to API routes:

```javascript
// /api/calls/outbound/route.ts
export async function POST(req: Request) {
  const { phone_number, test_mode } = await req.json();

  if (test_mode) {
    console.log('[TEST MODE] Call to:', phone_number);
    // Use test Vapi assistant
    // Use test Cal.com event type
    // Use test Twilio number
  }

  // Rest of logic...
}
```

**Make test call:**
```bash
curl -X POST https://your-app.vercel.app/api/calls/outbound \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"phone_number": "+15551234567", "test_mode": true}'
```

### 3. Separate Test Campaigns

Create campaigns specifically for testing:

```json
{
  "name": "[TEST] Q1 Outreach",
  "persona_id": 1,
  "contact_list": [
    {"full_name": "Test User", "phone_number": "+15551234567"}
  ],
  "tags": ["test"],
  "metadata": {"test_mode": true}
}
```

**Filter out test campaigns:**
```sql
SELECT * FROM campaigns WHERE NOT ('test' = ANY(tags));
```

### 4. Clean Up Test Data Regularly

**Weekly cleanup script:**
```bash
# Delete test calls older than 7 days
curl -X DELETE "https://your-app.vercel.app/api/calls?tags=test&older_than=7d" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Delete test contacts
curl -X DELETE "https://your-app.vercel.app/api/contacts?tags=test" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Delete test bookings
curl -X DELETE "https://your-app.vercel.app/api/bookings?tags=test" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Environment-Specific Configs

### Local Development

```bash
# .env.local
NODE_ENV=development
DEBUG=true
LOG_LEVEL=debug

# Use test credentials
VAPI_API_KEY=vapi_test_xxxxx
TWILIO_ACCOUNT_SID=AC_test_xxxxx
# ... other test keys
```

### Staging

```bash
# Vercel environment variables (staging)
NODE_ENV=staging
DEBUG=false
LOG_LEVEL=info

# Use separate staging keys
VAPI_API_KEY=vapi_staging_xxxxx
SUPABASE_URL=https://staging-project.supabase.co
# ... staging keys
```

### Production

```bash
# Vercel environment variables (production)
NODE_ENV=production
DEBUG=false
LOG_LEVEL=error

# Use production keys
VAPI_API_KEY=vapi_prod_xxxxx
SUPABASE_URL=https://prod-project.supabase.co
# ... production keys
```

## Testing Checklist

Before deploying to production, test:

### Voice Quality Test

- [ ] Make test call to your phone
- [ ] Verify voice is clear and natural
- [ ] Verify no lag or delay
- [ ] Verify agent doesn't interrupt
- [ ] Verify agent hears you correctly

### Booking Flow Test

- [ ] Request appointment during call
- [ ] Verify agent checks calendar
- [ ] Verify agent offers time slots
- [ ] Confirm a booking
- [ ] Verify booking appears in Cal.com
- [ ] Verify confirmation SMS received
- [ ] Verify booking saved to database

### Error Handling Test

- [ ] Say "I don't understand" → agent handles gracefully
- [ ] Request transfer → agent transfers correctly
- [ ] Hang up mid-call → call ends cleanly
- [ ] Call disconnected number → error logged correctly

### Compliance Test

- [ ] Say "remove me from list" → agent confirms and ends call
- [ ] Verify contact marked as DNC in database
- [ ] Verify contact not called again in future campaigns

## Security Best Practices

### Never Commit Secrets

**Bad:**
```javascript
// ❌ NEVER DO THIS
const apiKey = "vapi_123456789abcdef";
```

**Good:**
```javascript
// ✅ Always use environment variables
const apiKey = process.env.VAPI_API_KEY;
```

### .gitignore

Ensure `.gitignore` includes:

```
.env
.env.local
.env.test
.env.production
.env*.local
```

### Rotate Keys Quarterly

Set calendar reminders to rotate API keys every 3 months:

1. Generate new key in service dashboard
2. Update Vercel environment variables
3. Redeploy application
4. Delete old key after 24 hours (grace period)

### Use Secret Management

For production, consider:
- **Vercel Environment Variables** (encrypted at rest)
- **AWS Secrets Manager** (if using AWS)
- **HashiCorp Vault** (for advanced use cases)

## Troubleshooting

### "Invalid API Key" Error

**Check:**
1. Key is set in environment variables
2. Key has correct prefix (e.g., `vapi_`, `sk-`, `cal_live_`)
3. Key hasn't expired
4. Key has correct permissions

**Verify:**
```bash
echo $VAPI_API_KEY  # Should print key
# If empty, key not loaded
```

### "Environment Variable Not Found"

**Cause:** Variable not set in Vercel or not prefixed with `NEXT_PUBLIC_` for client-side.

**Solution:**
```bash
# Add to Vercel
vercel env add VAPI_API_KEY
# Redeploy
vercel --prod
```

### "Test Call Not Working"

**Checklist:**
- [ ] Using test phone number (yours or team member's)
- [ ] Test mode flag set (if implemented)
- [ ] All services healthy (`/api/health`)
- [ ] Vapi assistant exists
- [ ] Phone number in E.164 format

## Next Steps

- [Deployment Guide](./DEPLOYMENT.md) - Deploy to staging/production
- [Troubleshooting](./TROUBLESHOOTING.md) - Fix common issues
- [Security Guide](./SECURITY.md) - Secure your application

## Emergency Contacts

**If test credentials are compromised:**

1. **Immediately rotate all API keys**
2. **Check audit logs** for unauthorized access
3. **Contact service providers** (Vapi, Twilio, etc.) to report compromise
4. **Update team** on new credentials
5. **Review access logs** to identify breach source
