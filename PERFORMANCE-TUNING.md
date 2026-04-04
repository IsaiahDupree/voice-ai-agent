# Performance Tuning Guide

**F1497**: Tips for optimizing call latency and system responsiveness

---

## Performance Goals

| Metric | Target | Excellent | Acceptable |
|--------|--------|-----------|------------|
| First response (AI speaks) | < 1s | < 0.5s | < 2s |
| Tool execution (calendar check) | < 500ms | < 300ms | < 1s |
| Transcript generation | < 30s | < 15s | < 60s |
| Dashboard load time | < 2s | < 1s | < 3s |
| API response (P95) | < 500ms | < 300ms | < 1s |

---

## 1. Voice Latency Optimization

### Problem: Slow AI response time (> 2s)

**Causes:**
- Slow LLM inference
- Network latency to OpenAI
- Large system prompts
- Tool execution delays

**Solutions:**

#### A. Use Faster Models

```typescript
// Slower (higher quality)
model: {
  provider: 'openai',
  model: 'gpt-4o', // ~1-2s response time
}

// Faster (lower cost)
model: {
  provider: 'openai',
  model: 'gpt-4o-mini', // ~0.5-1s response time
}
```

**Trade-off:** GPT-4o-mini is 5x cheaper but slightly less capable at complex reasoning.

**Recommendation:** Start with gpt-4o-mini, upgrade to gpt-4o only if needed.

#### B. Optimize System Prompt

**Before (slow):**

```text
You are Sarah, a friendly sales assistant for Acme Corp. Acme Corp is a software company founded in 2020 that specializes in AI-powered automation tools for small and medium-sized businesses. Our flagship product is...

[3 more paragraphs of background]

When speaking with prospects, always:
- Start by introducing yourself and asking how they're doing
- Listen carefully to their needs and pain points
- Offer relevant solutions from our product catalog
- Handle objections with empathy and data-driven responses
- Aim to book a discovery call or demo
- If they're not interested, politely ask if you can follow up in 3 months
- Always end the call warmly regardless of outcome

[10 more bullet points]
```

**After (fast):**

```text
You are Sarah, a sales assistant for Acme Corp. Your goal: book discovery calls.

Key points:
- We offer AI automation tools for SMBs
- Main benefit: save 10+ hours/week on manual tasks
- Pricing: $500-2K/month

If interested → book call
If objection → acknowledge, offer one benefit, then pivot to booking
If hard no → thank them, end politely
```

**Improvement:** 80% shorter prompt = 40% faster inference

#### C. Reduce Tool Count

**Before:** 12 tools attached

```typescript
tools: [
  'checkCalendar', 'bookAppointment', 'cancelBooking', 'rescheduleBooking',
  'lookupContact', 'updateContact', 'createTask', 'sendSMS', 'sendEmail',
  'transferCall', 'endCall', 'optOutDNC'
]
```

**After:** 5 essential tools

```typescript
tools: [
  'checkCalendar', 'bookAppointment', 'lookupContact', 'sendSMS', 'transferCall'
]
```

**Improvement:** Fewer tools = faster tool selection = 20% faster responses

---

## 2. Database Optimization

### Problem: Slow API queries (> 1s)

**Causes:**
- Missing indexes
- Unoptimized queries
- Too many JOINs
- Large result sets without pagination

**Solutions:**

#### A. Add Indexes

**Slow queries identified via Supabase logs:**

```sql
-- Slow: fetching calls by phone number
SELECT * FROM voice_agent_calls WHERE from_number = '+15551234567';

-- Add index
CREATE INDEX idx_calls_from_number ON voice_agent_calls(from_number);

-- Slow: filtering by date range
SELECT * FROM voice_agent_calls WHERE created_at >= '2026-03-01';

-- Add index
CREATE INDEX idx_calls_created_at ON voice_agent_calls(created_at DESC);

-- Slow: joining calls + transcripts
SELECT c.*, t.transcript_text
FROM voice_agent_calls c
LEFT JOIN voice_agent_transcripts t ON t.call_id = c.call_id;

-- Add foreign key index
CREATE INDEX idx_transcripts_call_id ON voice_agent_transcripts(call_id);
```

**Performance gain:** 10-100x faster queries

#### B. Use Connection Pooling

**Before:**

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

**After:**

```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    db: {
      pooling: {
        min: 2,
        max: 10, // Adjust based on load
      },
    },
  }
)
```

**Performance gain:** Eliminates connection overhead (50-200ms)

#### C. Implement Query Caching

**For read-heavy analytics queries:**

```typescript
import { supabase } from '@/lib/supabase'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>()

export async function getCachedAnalytics(startDate: string, endDate: string) {
  const cacheKey = `analytics:${startDate}:${endDate}`
  const cached = cache.get(cacheKey)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data // Return cached result
  }

  // Fetch fresh data
  const { data } = await supabase
    .from('daily_analytics')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)

  cache.set(cacheKey, { data, timestamp: Date.now() })

  return data
}
```

**Performance gain:** Instant response for repeated queries

---

## 3. API Optimization

### Problem: Slow external API calls (Cal.com, Twilio, Vapi)

**Solutions:**

#### A. Parallel Execution

**Before (sequential):**

```typescript
// Total time: 1200ms
const contact = await lookupContact(phone) // 300ms
const availability = await checkCalendar(date) // 500ms
const booking = await createBooking(data) // 400ms
```

**After (parallel):**

```typescript
// Total time: 500ms (longest operation)
const [contact, availability] = await Promise.all([
  lookupContact(phone), // 300ms
  checkCalendar(date),  // 500ms
])

const booking = await createBooking(data) // 400ms (depends on above)
```

**Performance gain:** 60% faster

#### B. Timeout Configuration

**Prevent hanging requests:**

```typescript
async function checkCalendarWithTimeout(date: string) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

  try {
    const response = await fetch(calcomApiUrl, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)
    return response.json()
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('Cal.com request timed out')
      return { available: false, reason: 'timeout' }
    }
    throw error
  }
}
```

**Performance gain:** Prevents 30s+ hangs on slow APIs

#### C. Retry with Backoff

**For transient failures:**

```typescript
async function fetchWithRetry(url: string, options: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options)

      if (response.ok) {
        return response
      }

      // Retry on 5xx errors only
      if (response.status >= 500 && i < maxRetries - 1) {
        const delay = Math.min(1000 * 2 ** i, 5000) // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      return response
    } catch (error) {
      if (i === maxRetries - 1) throw error

      const delay = Math.min(1000 * 2 ** i, 5000)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
}
```

---

## 4. Transcript Processing

### Problem: Slow transcript generation (> 60s)

**Causes:**
- Large transcripts (long calls)
- Synchronous OpenAI calls for summary/action items
- Processing on each request instead of once

**Solutions:**

#### A. Async Processing

**Before (blocking):**

```typescript
// POST /api/transcripts
export async function POST(request) {
  const { callId, transcript } = await request.json()

  // This blocks for 10-15 seconds
  const analysis = await analyzeTranscriptFull(transcript)

  await supabase.from('voice_agent_transcripts').insert({ callId, ...analysis })

  return NextResponse.json({ success: true })
}
```

**After (background job):**

```typescript
// POST /api/transcripts
export async function POST(request) {
  const { callId, transcript } = await request.json()

  // Store immediately (< 100ms)
  await supabase.from('voice_agent_transcripts').insert({
    callId,
    transcript,
    analysis_status: 'pending',
  })

  // Queue background job
  await queueTranscriptAnalysis(callId)

  return NextResponse.json({ success: true, status: 'processing' })
}

// Separate worker or cron job
async function processTranscriptQueue() {
  const pending = await supabase
    .from('voice_agent_transcripts')
    .select('*')
    .eq('analysis_status', 'pending')
    .limit(10)

  for (const record of pending.data) {
    const analysis = await analyzeTranscriptFull(record.transcript)

    await supabase
      .from('voice_agent_transcripts')
      .update({ ...analysis, analysis_status: 'completed' })
      .eq('id', record.id)
  }
}
```

**Performance gain:** API responds in 100ms instead of 15s

#### B. Batch OpenAI Calls

**Before:**

```typescript
for (const transcript of transcripts) {
  const summary = await generateSummary(transcript) // 10 sequential OpenAI calls
}
```

**After:**

```typescript
const summaries = await Promise.all(
  transcripts.map(t => generateSummary(t)) // 10 parallel OpenAI calls
)
```

**Performance gain:** 10x faster for batch processing

---

## 5. Dashboard Performance

### Problem: Slow page loads (> 3s)

**Solutions:**

#### A. Use Server Components

**Before (client-side fetch):**

```typescript
'use client'

export default function CallsPage() {
  const [calls, setCalls] = useState([])

  useEffect(() => {
    fetch('/api/calls').then(res => res.json()).then(setCalls)
  }, [])

  return <CallList calls={calls} />
}
```

**After (server component):**

```typescript
// app/calls/page.tsx
import { supabaseAdmin } from '@/lib/supabase'

export default async function CallsPage() {
  const { data: calls } = await supabaseAdmin
    .from('voice_agent_calls')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  return <CallList calls={calls} />
}
```

**Performance gain:** Data fetched on server (faster DB connection, no API roundtrip)

#### B. Implement Pagination

**Before (load all):**

```typescript
const { data } = await supabase.from('voice_agent_calls').select('*') // 10,000 rows
```

**After (paginate):**

```typescript
const page = 1
const limit = 50
const offset = (page - 1) * limit

const { data, count } = await supabase
  .from('voice_agent_calls')
  .select('*', { count: 'exact' })
  .range(offset, offset + limit - 1) // Load 50 rows only
```

**Performance gain:** 200x faster for large datasets

#### C. Optimize Images

**For dashboard logos/avatars:**

```typescript
import Image from 'next/image'

// Before
<img src="/logo.png" width={200} height={50} />

// After (optimized)
<Image
  src="/logo.png"
  width={200}
  height={50}
  alt="Logo"
  priority // For above-fold images
/>
```

**Performance gain:** Automatic WebP conversion, lazy loading, size optimization

---

## 6. Monitoring & Profiling

### Identify Bottlenecks

#### A. API Route Profiling

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const start = Date.now()

  const response = NextResponse.next()

  response.headers.set('X-Response-Time', `${Date.now() - start}ms`)

  return response
}
```

**Check response time header:**

```bash
curl -I https://your-domain.vercel.app/api/calls
# X-Response-Time: 342ms
```

#### B. Database Query Logging

**Enable slow query log:**

```typescript
// lib/supabase.ts
supabase.from('voice_agent_calls').select('*').explain() // Shows query plan
```

**Check Supabase logs for queries > 1s**

#### C. Vercel Analytics

**Enable Web Vitals:**

```bash
vercel env add NEXT_PUBLIC_VERCEL_ANALYTICS_ID
```

**Monitor:**
- Time to First Byte (TTFB)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)

---

## 7. Cost vs Performance Trade-offs

| Optimization | Performance Gain | Cost Impact |
|--------------|------------------|-------------|
| GPT-4o → GPT-4o-mini | +50% faster | -80% cost |
| Add DB indexes | +10-100x faster queries | No cost |
| Enable caching | Instant for cached queries | No cost |
| Connection pooling | +30% faster API | No cost |
| Async transcript processing | +90% faster API response | No cost |
| Server components | +40% faster page loads | No cost |
| CDN for static assets | +60% faster initial load | ~$5/month (Vercel) |

**Best ROI:** DB indexes + caching + async processing = 10x performance boost at $0 cost

---

## Summary Checklist

- [ ] Use GPT-4o-mini for faster, cheaper responses
- [ ] Optimize system prompts (< 500 words)
- [ ] Limit tools to 5-7 essentials
- [ ] Add database indexes on frequently queried fields
- [ ] Enable connection pooling
- [ ] Cache read-heavy analytics queries (5 min TTL)
- [ ] Use Promise.all() for parallel API calls
- [ ] Add timeouts to external API requests (5s max)
- [ ] Process transcripts asynchronously
- [ ] Use Next.js Server Components
- [ ] Implement pagination (50 rows/page)
- [ ] Enable Vercel Analytics
- [ ] Monitor slow queries in Supabase logs
