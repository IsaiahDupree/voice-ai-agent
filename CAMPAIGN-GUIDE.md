# Campaign Setup Guide

## What is a Campaign?

A **campaign** is an organized outbound calling initiative where your AI agent calls a list of contacts with a specific goal (e.g., book meetings, qualify leads, conduct surveys).

## Campaign Lifecycle

```
Draft → Active → Paused → Completed → Archived
  ↓       ↓        ↓          ↓           ↓
Edit   Calling  Resume    Reports     Delete
```

## Quick Start: Create Your First Campaign

### Step 1: Prepare Your Contact List

**Format: CSV or JSON**

**CSV format:**
```csv
full_name,phone_number,email,company,title
John Doe,+15551234567,john@acme.com,Acme Inc,CEO
Jane Smith,+15559876543,jane@techcorp.com,TechCorp,CTO
```

**JSON format:**
```json
[
  {
    "full_name": "John Doe",
    "phone_number": "+15551234567",
    "email": "john@acme.com",
    "company": "Acme Inc",
    "title": "CEO"
  }
]
```

**Requirements:**
- ✅ Phone numbers in E.164 format (`+1555...`)
- ✅ No duplicate phone numbers
- ✅ `full_name` and `phone_number` are required
- ❌ No landlines (mobile/direct lines only)
- ❌ No Do Not Call (DNC) numbers

**Validation tool:**
```bash
curl -X POST https://your-app.vercel.app/api/contacts/validate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -F "file=@contacts.csv"
```

Returns:
```json
{
  "valid": 245,
  "invalid": 5,
  "errors": [
    {"row": 12, "error": "Invalid phone format: 555-1234"},
    {"row": 34, "error": "Duplicate phone: +15551234567"}
  ]
}
```

### Step 2: Create Campaign

**Via Dashboard:**

1. Navigate to **Dashboard → Campaigns**
2. Click **"New Campaign"**
3. Fill in:
   - **Name**: e.g., "Q1 Outreach - SaaS CEOs"
   - **Persona**: Select your AI agent persona
   - **Upload Contacts**: CSV or JSON file
   - **Calling Hours**: 9am - 5pm (caller's timezone)
   - **Max Attempts**: 3 (calls per contact)
   - **Voicemail**: Optional voicemail message
4. Click **"Create Campaign"** (saves as Draft)

**Via API:**

```bash
curl -X POST https://your-app.vercel.app/api/campaigns \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Q1 Outreach - SaaS CEOs",
    "persona_id": 1,
    "contact_list": [
      {
        "full_name": "John Doe",
        "phone_number": "+15551234567",
        "email": "john@acme.com",
        "company": "Acme Inc"
      }
    ],
    "calling_hours_start": "09:00",
    "calling_hours_end": "17:00",
    "timezone": "America/New_York",
    "max_attempts_per_contact": 3,
    "voicemail_message": "Hi, this is Sarah from CloudSync. I'd love to chat about how we can help reduce your cloud costs. Please call me back at 555-1234."
  }'
```

Response:
```json
{
  "id": 42,
  "name": "Q1 Outreach - SaaS CEOs",
  "status": "draft",
  "total_contacts": 250,
  "created_at": "2026-03-28T10:00:00Z"
}
```

### Step 3: Review and Test

Before starting a campaign, always test with 1-2 calls:

**Test call:**
```bash
curl -X POST https://your-app.vercel.app/api/campaigns/42/test \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"phone_number": "+15551234567"}'
```

This makes a single test call outside the campaign. Review:
- ✅ Does greeting sound natural?
- ✅ Does agent handle objections well?
- ✅ Does agent book appointments correctly?
- ✅ Is call duration reasonable (2-5 minutes)?

### Step 4: Start Campaign

**Via Dashboard:**
1. Dashboard → Campaigns → [Your Campaign]
2. Click **"Start Campaign"**
3. Confirm calling hours and settings
4. Monitor live calls in dashboard

**Via API:**
```bash
curl -X POST https://your-app.vercel.app/api/campaigns/42/actions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"action": "start"}'
```

**What happens:**
- Campaign status changes to `active`
- System queues contacts for calling
- Calls start within 1 minute
- Contacts called during configured hours only

## Campaign Settings

### Calling Hours

**Purpose:** Respect caller timezones and avoid calling at inappropriate times.

**Settings:**
- `calling_hours_start`: e.g., `"09:00"` (9am local time)
- `calling_hours_end`: e.g., `"17:00"` (5pm local time)
- `timezone`: Contact's timezone (defaults to `America/New_York`)

**Best practices:**
- **B2B calls**: 9am-5pm local time, Tuesday-Thursday (avoid Mondays and Fridays)
- **B2C calls**: 10am-8pm local time, avoid dinner time (5-7pm)
- **Multi-timezone campaigns**: System auto-detects timezone from phone area code

**Timezone detection:**
```javascript
// Area code 415 = San Francisco = America/Los_Angeles
// Area code 212 = New York = America/New_York
// Auto-detected by lib/phone-utils.ts
```

### Max Attempts Per Contact

**Purpose:** Retry no-answer or voicemail contacts without being annoying.

**Recommended settings:**
- **3 attempts**: Most campaigns (call 1, wait 24h, call 2, wait 48h, call 3)
- **1 attempt**: High-value leads (single touch, then hand-off to sales)
- **5 attempts**: Appointment reminders (aggressive follow-up)

**Retry logic:**
```
Attempt 1: Immediate (when campaign starts)
Attempt 2: +24 hours after attempt 1 (if no answer or voicemail)
Attempt 3: +48 hours after attempt 2 (if no answer or voicemail)
```

**Stop retry if:**
- Contact answers and has a conversation
- Contact asks to be removed
- Contact number is disconnected

### Voicemail Detection

**How it works:**
1. Vapi detects voicemail via audio analysis
2. If detected, agent leaves pre-recorded message
3. Call logged as outcome: `voicemail`
4. Contact marked for retry (unless max attempts reached)

**Voicemail message tips:**
- ✅ Keep under 20 seconds
- ✅ Identify yourself and company
- ✅ State purpose clearly
- ✅ Provide callback number
- ❌ Don't be too salesy
- ❌ Don't leave multiple voicemails (1 per contact max)

**Example voicemail:**
```
"Hi, this is Sarah from CloudSync. I'd love to chat about how we can help reduce your cloud costs by 30%. Please call me back at 555-1234, or visit cloudync.com/demo. Thanks!"
```

### Concurrent Calls

**Default:** 5 concurrent calls at a time

**Why limit concurrency:**
- External API rate limits (Vapi, Cal.com, Twilio)
- Database connection pool limits
- Cost control (Vapi charges per minute)

**Adjust concurrency:**
```bash
# Increase to 10 concurrent calls
curl -X PATCH https://your-app.vercel.app/api/campaigns/42 \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"concurrent_calls": 10}'
```

**Capacity guide:**
| Concurrent Calls | Contacts/Hour | Cost/Hour (Vapi) |
|-----------------|---------------|------------------|
| 1 | ~15 | $3 |
| 5 (default) | ~75 | $15 |
| 10 | ~150 | $30 |
| 20 | ~300 | $60 |

## Campaign Monitoring

### Live Dashboard

**Dashboard → Campaigns → [Campaign] → Live**

Shows:
- Active calls (name, duration, status)
- Recent completions (outcome, booking made)
- Stats: calls today, bookings, average duration
- Next contacts in queue

### Real-time Metrics

```json
{
  "campaign_id": 42,
  "status": "active",
  "stats": {
    "total_contacts": 250,
    "completed_calls": 87,
    "pending_calls": 163,
    "bookings_made": 23,
    "conversion_rate": 26.4,
    "avg_call_duration": 180,
    "outcomes": {
      "booking_made": 23,
      "interested": 15,
      "not_interested": 34,
      "no_answer": 10,
      "voicemail": 5
    }
  }
}
```

### Export Call Data

**Via Dashboard:**
1. Dashboard → Campaigns → [Campaign] → Export
2. Select date range
3. Download CSV with:
   - Contact name, phone, company
   - Call status, outcome, duration
   - Transcript summary
   - Booking details

**Via API:**
```bash
curl -X GET "https://your-app.vercel.app/api/campaigns/42/calls?format=csv" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  > campaign_calls.csv
```

## Campaign Actions

### Pause Campaign

**When to pause:**
- End of business day
- Need to adjust persona or messaging
- External API issue detected

**Via Dashboard:** Dashboard → Campaigns → [Campaign] → Pause

**Via API:**
```bash
curl -X POST https://your-app.vercel.app/api/campaigns/42/actions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"action": "pause"}'
```

**Effect:**
- No new calls started
- Active calls complete normally
- Campaign can be resumed later

### Resume Campaign

**Via Dashboard:** Dashboard → Campaigns → [Campaign] → Resume

**Via API:**
```bash
curl -X POST https://your-app.vercel.app/api/campaigns/42/actions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"action": "resume"}'
```

### Stop Campaign

**Difference from pause:** Stops permanently (cannot be resumed).

**When to stop:**
- Campaign goal achieved
- Contact list exhausted
- Campaign underperforming

**Via API:**
```bash
curl -X POST https://your-app.vercel.app/api/campaigns/42/actions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"action": "stop"}'
```

**Effect:**
- Campaign status → `completed`
- No more calls placed
- Stats frozen for reporting

## Advanced Features

### Dynamic Contact Lists

Add contacts to an active campaign:

```bash
curl -X POST https://your-app.vercel.app/api/campaigns/42/contacts \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{
    "contacts": [
      {"full_name": "New Lead", "phone_number": "+15551234567"}
    ]
  }'
```

**Use case:** Integrate with CRM to auto-add new leads to ongoing campaigns.

### Remove Contacts

Remove a contact from campaign (e.g., if they called back directly):

```bash
curl -X DELETE https://your-app.vercel.app/api/campaigns/42/contacts/123 \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### DNC (Do Not Call) Handling

**Automatic DNC:**
- If contact says "remove me" or "don't call again", agent marks contact as DNC
- Contact added to global DNC list
- Contact skipped in all future campaigns

**Manual DNC:**
```bash
curl -X POST https://your-app.vercel.app/api/contacts/123/dnc \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Check DNC status:**
```bash
curl -X GET https://your-app.vercel.app/api/contacts?dnc=true \
  -H "Authorization: Bearer YOUR_API_KEY"
```

### Campaign Cloning

Clone a campaign (useful for A/B testing):

**Via Dashboard:** Dashboard → Campaigns → [Campaign] → Duplicate

**Modify:**
- Change persona (test different voice/messaging)
- Adjust calling hours (test different times)
- Change max attempts (test persistence)

**Run both campaigns** and compare booking rates.

### Campaign Scheduling

Schedule a campaign to start later:

```bash
curl -X POST https://your-app.vercel.app/api/campaigns \
  -d '{
    "name": "Morning Outreach",
    "scheduled_start": "2026-03-29T09:00:00Z",
    "scheduled_end": "2026-03-29T12:00:00Z",
    ...
  }'
```

**Use case:** Queue campaigns to run overnight or during specific hours.

## Campaign Templates

### Template 1: Appointment Setter

**Goal:** Book discovery calls

**Settings:**
- Persona: Appointment scheduler
- Calling hours: 9am-5pm
- Max attempts: 3
- Voicemail: Yes

**Success metrics:**
- Booking rate: 15-25%
- Average call duration: 2-3 minutes

### Template 2: Lead Qualifier

**Goal:** Identify interested leads for sales follow-up

**Settings:**
- Persona: Sales SDR
- Calling hours: 10am-4pm (avoid mornings/EOD)
- Max attempts: 2
- Voicemail: No (SDR follows up manually)

**Success metrics:**
- Interest rate: 30-40%
- Qualified leads: 10-15%

### Template 3: Event Reminder

**Goal:** Confirm attendance for upcoming event

**Settings:**
- Persona: Event coordinator
- Calling hours: 9am-8pm (flexible)
- Max attempts: 5 (aggressive)
- Voicemail: Yes (short reminder)

**Success metrics:**
- Answer rate: 60-70%
- Confirmation rate: 80-90%

## Troubleshooting

### "Calls not starting"

**Check:**
1. Campaign status is `active` (not `draft`)
2. Current time is within calling hours
3. Contacts have valid phone numbers (E.164 format)
4. Vapi account has available minutes
5. `/api/health` shows all services are up

### "Low answer rate (<30%)"

**Solutions:**
- Call during better hours (Tue-Thu, 10am-4pm)
- Try local presence numbers (match area code to contact)
- Reduce concurrent calls (spread out timing)
- Check if numbers are mobile vs landline

### "High no-answer rate"

**Solutions:**
- Increase max attempts to 3-5
- Space out attempts (24-48 hours between)
- Leave voicemail on attempt 2
- Try different calling hours

### "Low booking conversion (<10%)"

**Solutions:**
- Review persona system prompt (too aggressive?)
- Test agent with sample calls
- Check if Cal.com calendar has limited availability
- Add more value to pitch
- Shorten call script (get to point faster)

### "Contacts marked DNC"

**Check:**
- Agent is honoring opt-out requests correctly
- Review transcripts to confirm caller requested DNC
- No false positives (system misheard "I'll call you back" as "don't call")

### "Campaign running slow"

**Causes:**
- Low concurrent call limit (default 5)
- Calling hours too restrictive (only 2-3 hours/day)
- External API rate limits hit

**Solutions:**
- Increase concurrent calls to 10-20
- Expand calling hours window
- Check `/api/health` for API connectivity

## Compliance Best Practices

- [ ] Scrub contact list against DNC registry before campaign
- [ ] Respect calling hours (no early morning or late night calls)
- [ ] Honor opt-out requests immediately
- [ ] Keep call recordings for 90 days (TCPA requirement)
- [ ] Agent identifies company and purpose at start of call
- [ ] Provide callback number in voicemail

See [TCPA-COMPLIANCE.md](./TCPA-COMPLIANCE.md) for full guidelines.

## Next Steps

- [Persona Builder Guide](./PERSONA-GUIDE.md) - Create and test your persona
- [Cal.com Setup](./CALCOM-SETUP.md) - Configure appointment booking
- [Analytics Guide](./ANALYTICS-GUIDE.md) - Measure campaign performance
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues
