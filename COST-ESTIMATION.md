# Cost Estimation Guide

## Overview

This guide helps you estimate the monthly cost of running your Voice AI Agent system based on call volume and features used.

## Cost Breakdown by Service

### 1. Vapi (Voice Orchestration)

**Pricing:** Pay-per-minute

| Plan | Cost | Included Minutes | Overage Rate |
|------|------|-----------------|--------------|
| Pay-as-you-go | $0/mo | 0 | $0.10/min |
| Developer | $99/mo | 1,000 min | $0.09/min |
| Growth | $299/mo | 5,000 min | $0.08/min |
| Scale | $999/mo | 20,000 min | $0.07/min |

**Calculation:**
```
Vapi Cost = (Total call minutes × Rate per minute)

Example: 1,000 calls × 3 min avg = 3,000 minutes
Pay-as-you-go: 3,000 min × $0.10 = $300/mo
Developer plan: $99 + (2,000 min × $0.09) = $279/mo ✓ Better
```

**Recommendation:**
- < 1,000 min/mo: Pay-as-you-go
- 1,000 - 5,000 min/mo: Developer plan
- 5,000 - 20,000 min/mo: Growth plan
- > 20,000 min/mo: Scale plan

### 2. OpenAI (LLM)

**Pricing:** Per token (input + output)

| Model | Input | Output |
|-------|-------|--------|
| GPT-4o | $5.00 / 1M tokens | $15.00 / 1M tokens |
| GPT-4o-mini | $0.15 / 1M tokens | $0.60 / 1M tokens |
| GPT-3.5-turbo | $0.50 / 1M tokens | $1.50 / 1M tokens |

**Calculation:**
```
Average 3-minute call:
- System prompt: ~500 tokens (input)
- Conversation: ~600 tokens input, ~400 tokens output per call

Total tokens per call: 1,500 input, 400 output

GPT-4o cost per call:
- Input: (1,500 / 1,000,000) × $5.00 = $0.0075
- Output: (400 / 1,000,000) × $15.00 = $0.006
- Total per call: $0.0135

1,000 calls/mo: $13.50
10,000 calls/mo: $135
```

**Recommendation:** Use GPT-4o (default). GPT-4o-mini saves $0.012/call but has lower quality.

### 3. Anthropic Claude (Alternative LLM)

**Pricing:** Per token

| Model | Input | Output |
|-------|-------|--------|
| Claude 3.5 Sonnet | $3.00 / 1M tokens | $15.00 / 1M tokens |
| Claude 3 Haiku | $0.25 / 1M tokens | $1.25 / 1M tokens |

**Calculation:**
```
Same token usage as GPT-4o:

Claude 3.5 Sonnet cost per call:
- Input: (1,500 / 1,000,000) × $3.00 = $0.0045
- Output: (400 / 1,000,000) × $15.00 = $0.006
- Total per call: $0.0105

1,000 calls/mo: $10.50 (saves $3 vs GPT-4o)
10,000 calls/mo: $105 (saves $30 vs GPT-4o)
```

**Recommendation:** Claude 3.5 Sonnet if you prefer Claude's conversation style (slightly cheaper than GPT-4o).

### 4. ElevenLabs (TTS)

**Pricing:** Per character

| Plan | Cost | Characters/mo | Overage |
|------|------|--------------|---------|
| Free | $0 | 10,000 | N/A |
| Starter | $5/mo | 30,000 | $0.00017/char |
| Creator | $22/mo | 100,000 | $0.00022/char |
| Pro | $99/mo | 500,000 | $0.00020/char |
| Scale | $330/mo | 2,000,000 | $0.00017/char |

**Calculation:**
```
Average 3-minute call:
- Agent speaks ~300 words = ~1,800 characters

1,000 calls/mo: 1.8M characters
Pro plan: $99 + ((1,800,000 - 500,000) × $0.0002) = $99 + $260 = $359/mo
Scale plan: $330 + ((1,800,000 - 2,000,000) × $0.00017) = $330/mo ✓ Better
```

**Recommendation:**
- < 100 calls/mo: Starter plan
- 100 - 500 calls/mo: Creator plan
- 500 - 1,000 calls/mo: Pro plan
- > 1,000 calls/mo: Scale plan

**Cost optimization:** Keep agent responses short (1-2 sentences).

### 5. Deepgram (STT)

**Pricing:** Per minute of audio

| Tier | Cost/min |
|------|----------|
| Pay-as-you-go | $0.0043 |
| Pre-paid (Growth) | $0.0036 (with $200 commitment) |

**Calculation:**
```
3-minute call: 3 × $0.0043 = $0.0129/call

1,000 calls/mo: $12.90
10,000 calls/mo: $129
```

**Included in Vapi pricing** (may vary, check Vapi dashboard).

### 6. Twilio (SMS)

**Pricing:** Per SMS

| Type | Cost |
|------|------|
| US SMS | $0.0079/message |
| MMS | $0.02/message |
| International SMS | $0.05 - $0.20/message |

**Calculation:**
```
Booking confirmation SMS per call:
1,000 bookings/mo: 1,000 × $0.0079 = $7.90
```

**Optional:** Twilio phone numbers ($1.15/mo each) if using PSTN inbound.

### 7. Cal.com (Scheduling)

**Pricing:**

| Plan | Cost | Calendars | Event Types |
|------|------|-----------|-------------|
| Free | $0 | 1 | Unlimited |
| Pro | $15/mo | Unlimited | Unlimited |
| Team | $30/mo/seat | Unlimited | Unlimited |

**Recommendation:** Free plan is sufficient for most use cases.

### 8. Supabase (Database)

**Pricing:**

| Plan | Cost | Database | Storage | Egress |
|------|------|----------|---------|--------|
| Free | $0 | 500 MB | 1 GB | 2 GB/mo |
| Pro | $25/mo | 8 GB | 100 GB | 250 GB/mo |
| Team | $599/mo | Dedicated | Unlimited | 1 TB/mo |

**Calculation:**
```
Database usage per call:
- Call record: ~500 bytes
- Transcript: ~3 KB
- Metadata: ~1 KB
Total per call: ~4.5 KB

1,000 calls/mo: 4.5 MB (easily fits in free tier)
10,000 calls/mo: 45 MB (still free tier)
100,000 calls/mo: 450 MB (free tier limit)
> 100,000 calls/mo: Upgrade to Pro ($25/mo)
```

**Recommendation:**
- < 100,000 calls/mo: Free tier
- > 100,000 calls/mo: Pro tier

### 9. Vercel (Hosting)

**Pricing:**

| Plan | Cost | Bandwidth | Build Time | Serverless Executions |
|------|------|-----------|-----------|----------------------|
| Hobby | $0 | 100 GB | 100 hrs | 100 GB-hrs |
| Pro | $20/mo | 1 TB | Unlimited | 1000 GB-hrs |
| Enterprise | Custom | Custom | Unlimited | Custom |

**Calculation:**
```
Bandwidth per call:
- API requests: ~50 KB
- Webhook: ~10 KB
Total: ~60 KB/call

1,000 calls/mo: 60 MB (well within Hobby)
10,000 calls/mo: 600 MB (still Hobby)
100,000 calls/mo: 6 GB (still Hobby)

Recommendation: Hobby plan is sufficient unless you have heavy dashboard traffic.
```

## Total Cost Examples

### Scenario 1: Small Operation (100 calls/month)

| Service | Cost |
|---------|------|
| Vapi (300 min) | $30 |
| OpenAI GPT-4o | $1.35 |
| ElevenLabs Starter | $5 |
| Deepgram | Included |
| Twilio SMS (100) | $0.79 |
| Cal.com Free | $0 |
| Supabase Free | $0 |
| Vercel Hobby | $0 |
| **Total** | **$37.14/mo** |

**Per call cost:** $0.37

### Scenario 2: Medium Operation (1,000 calls/month)

| Service | Cost |
|---------|------|
| Vapi (3,000 min) | $279 (Developer plan) |
| OpenAI GPT-4o | $13.50 |
| ElevenLabs Pro | $359 |
| Deepgram | Included |
| Twilio SMS (1,000) | $7.90 |
| Cal.com Free | $0 |
| Supabase Free | $0 |
| Vercel Hobby | $0 |
| **Total** | **$659.40/mo** |

**Per call cost:** $0.66

### Scenario 3: Large Operation (10,000 calls/month)

| Service | Cost |
|---------|------|
| Vapi (30,000 min) | $2,099 (Scale plan) |
| OpenAI GPT-4o | $135 |
| ElevenLabs Scale | $660 |
| Deepgram | Included |
| Twilio SMS (10,000) | $79 |
| Cal.com Pro | $15 |
| Supabase Free | $0 |
| Vercel Hobby | $0 |
| **Total** | **$2,988/mo** |

**Per call cost:** $0.30

### Scenario 4: Enterprise (100,000 calls/month)

| Service | Cost |
|---------|------|
| Vapi (300,000 min) | $21,000 (custom) |
| OpenAI GPT-4o | $1,350 |
| ElevenLabs Enterprise | $3,000 (custom) |
| Deepgram | Included |
| Twilio SMS (100,000) | $790 |
| Cal.com Team (5 seats) | $150 |
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| **Total** | **$26,335/mo** |

**Per call cost:** $0.26

## Cost Optimization Tips

### 1. Reduce Call Duration

**Impact:** Every minute saved = $0.10 per call

**How to optimize:**
- Keep agent responses short (1-2 sentences)
- Use system prompt to enforce brevity: "Keep all responses under 20 words"
- Transfer to human for complex inquiries (human time cheaper than AI)
- End call immediately after outcome achieved

**Example:**
```
❌ Long (60 seconds):
"Thank you so much for calling today. I really appreciate you taking the time to speak with me. I understand you're interested in our services. That's wonderful! Let me tell you a bit about what we offer..."

✅ Short (15 seconds):
"Thanks for calling! I understand you're interested in our services. Let me check our calendar for available times."

Savings: 45 seconds = $0.075 per call
At 1,000 calls/mo: $75/mo saved
```

### 2. Use GPT-4o-mini for Simple Tasks

**Impact:** Saves $0.012 per call (~90% cheaper)

**Use GPT-4o-mini for:**
- Appointment reminders (scripted, simple)
- Surveys (fixed questions)
- Simple qualification (yes/no questions)

**Use GPT-4o for:**
- Sales calls (needs persuasion, objection handling)
- Complex support (problem-solving)
- Personalization (needs context awareness)

### 3. Batch SMS Sending

**Impact:** Minimal (SMS is already cheap)

**Optimization:**
- Only send SMS if booking made (not on every call)
- Use email for long confirmations (cheaper)
- Combine multiple notifications into one SMS

### 4. Optimize Agent Voice Output

**Impact:** Save $100+/mo on ElevenLabs

**How:**
- Remove filler words: "um", "you know", "like"
- Avoid repeating information already said
- Don't narrate actions: ❌ "Let me check the calendar for you" → ✅ "Checking calendar..."

**Character reduction:**
```
Before (verbose): 2,000 characters/call
After (optimized): 1,500 characters/call
Savings: 500 chars × 1,000 calls = 500,000 chars/mo
At Pro plan overage rate: 500,000 × $0.0002 = $100/mo saved
```

### 5. Use Caching

**Impact:** Reduce API calls, improve speed

**Cache:**
- Cal.com availability (5-minute cache)
- Contact lookups (1-hour cache)
- Inventory status (variable)

**Example:**
```javascript
// Cache Cal.com availability
const cachedAvailability = await redis.get(`cal:${eventTypeId}:${date}`);
if (cachedAvailability) {
  return JSON.parse(cachedAvailability);
}

const availability = await calcom.checkAvailability(eventTypeId, date);
await redis.setex(`cal:${eventTypeId}:${date}`, 300, JSON.stringify(availability)); // 5 min
return availability;
```

### 6. Transcript Archiving

**Impact:** Reduce database costs at scale

**Strategy:**
- Keep recent transcripts (30 days) in Supabase
- Archive old transcripts to S3 ($0.023/GB/mo)
- Compress transcripts before archiving

**Example:**
```
10,000 calls/mo × 3 KB transcript = 30 MB/mo
Annual: 360 MB
Supabase Pro: Included
S3 archive (after 30 days): 360 MB × $0.023 = $0.008/mo (negligible)
```

### 7. Rate Limit Aggressive Callers

**Impact:** Prevent abuse, save on Vapi minutes

**Strategy:**
- Limit 5 calls per number per day
- Block numbers with >10 failed calls
- Charge for high-volume usage

## ROI Calculation

### Cost vs Benefit

**Typical outbound sales campaign:**

| Metric | Value |
|--------|-------|
| Calls made | 1,000 |
| Answer rate | 40% |
| Booking rate | 25% of answers |
| Total bookings | 100 |
| Booking value | $2,500 each |
| Total revenue | $250,000 |
| AI agent cost | $660/mo |
| **ROI** | **37,800%** |

**Compare to human SDR:**
- Salary: $60,000/year = $5,000/mo
- Can make ~200 calls/month
- Same booking rate: 20 bookings/mo = $50,000 revenue
- **AI makes 5x more calls at 13% of the cost**

### Break-Even Analysis

**Cost per booking:**
```
AI agent: $660 ÷ 100 bookings = $6.60/booking
Human SDR: $5,000 ÷ 20 bookings = $250/booking
```

**Break-even:**
```
If booking value > $6.60, AI is profitable
Typical booking values: $500 - $5,000+
```

## Monthly Budget Planner

Use this template to estimate your costs:

```
Expected monthly calls: _______

Vapi: _______ min × $0.10 = $_______
OpenAI: _______ calls × $0.0135 = $_______
ElevenLabs: _______ calls × 1,800 chars × $_______ = $_______
Twilio SMS: _______ messages × $0.0079 = $_______
Cal.com: $_______
Supabase: $_______
Vercel: $_______

Total estimated cost: $_______
Per-call cost: $_______ ÷ _______ calls = $_______
```

## Next Steps

- [Deployment Guide](./DEPLOYMENT.md) - Deploy your system
- [Campaign Setup](./CAMPAIGN-GUIDE.md) - Launch campaigns
- [Analytics](./ANALYTICS-GUIDE.md) - Track performance and ROI
