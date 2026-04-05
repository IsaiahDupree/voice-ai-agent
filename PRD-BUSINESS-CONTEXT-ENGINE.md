# PRD: Business Context Engine
**Status:** Draft
**Version:** 1.0
**Created:** 2026-04-04

---

## Problem

A voice AI agent cold-calling on behalf of a client sounds generic and untrustworthy if it doesn't know the client's business. Dumping an entire scraped website into the system prompt is slow, expensive, and causes hallucination. There's no clean path today from "give us a domain" to "Vapi agent that sounds informed."

---

## Goal

Build a pipeline that takes a business domain, crawls its public website, extracts a structured business profile, compresses it to a short usable brief, and injects that context into a Vapi agent before or during a call — without bloating the prompt.

---

## Users

- **Agency operators** — running outbound campaigns for multiple client businesses; need to onboard a new client in minutes, not days
- **Solo founders** — want their own Vapi agent to know their business deeply before making calls

---

## Non-goals

- Crawling private/gated content
- Real-time website monitoring (not a live sync, just a point-in-time crawl)
- Replacing a full knowledge base (RAG over large doc sets is a separate system)
- Building a generic SEO scraper

---

## Architecture

```
Domain Input
     ↓
[ Crawler ]  ←─ Firecrawl /map + /crawl
     ↓
[ Extractor ] ←─ LLM pass → structured JSON
     ↓
[ Storage ] ←─ Supabase (business_profiles + chunks)
     ↓
[ Context API ] ←─ GET /api/business-context?domain=...
     ↓
[ Vapi Handoff ] ←─ assistantOverrides.variableValues
                 └─ API Request tool for live lookup
     ↓
[ Post-Call ] ←─ Vapi structured output → Supabase CRM
```

---

## Phase 1: Crawler

### Input
```ts
{
  domain: string          // "acme-roofing.com"
  alias?: string          // optional business name hint
  maxPages?: number       // default 25
  priorityPaths?: string[] // override default priority list
}
```

### Crawl Strategy
1. **Map first** — hit Firecrawl `/map?url=https://{domain}` to get all discovered URLs (~100ms)
2. **Filter** — score URLs by path pattern, keep top `maxPages` by relevance
3. **Crawl** — hit Firecrawl `/crawl` with filtered URL list, JS rendering enabled, clean markdown output

### URL Priority Scoring (descending)
| Score | Path patterns |
|-------|---------------|
| 10 | `/`, `/home` |
| 9 | `/about`, `/who-we-are`, `/company`, `/our-story` |
| 8 | `/services`, `/solutions`, `/what-we-do`, `/offerings` |
| 7 | `/pricing`, `/plans`, `/packages` |
| 7 | `/industries`, `/markets`, `/sectors` |
| 6 | `/faq`, `/questions`, `/help` |
| 6 | `/case-studies`, `/results`, `/success-stories`, `/portfolio` |
| 5 | `/testimonials`, `/reviews`, `/clients` |
| 5 | `/contact`, `/locations`, `/book`, `/schedule` |
| 4 | `/team`, `/leadership`, `/staff` |
| 3 | `/blog/*` (first post only) |
| 0 | `/privacy`, `/terms`, `/login`, `/cart`, `/checkout`, `/sitemap` |

### Excluded by default
- Login-gated pages
- Payment / checkout flows
- Admin paths
- Dynamic query params with session tokens
- `/cdn-cgi/`, `/_next/`, `/api/`

---

## Phase 2: Extractor

### LLM Pass
Single prompt over all crawled page content (concatenated, deduplicated, trimmed to fit context window). Output is strict JSON matching the Business Profile schema.

**Model:** `claude-opus-4-6` for extraction accuracy
**Temperature:** 0 (deterministic)
**Output format:** JSON with validation

### Business Profile Schema

```ts
interface BusinessProfile {
  // Identity
  domain: string
  company_name: string
  one_sentence_summary: string        // ≤30 words
  elevator_pitch: string              // 2-3 sentences
  founded_year?: number
  company_size?: string               // "1-10", "11-50", etc.

  // What they do
  industries_served: string[]
  services: Array<{
    name: string
    description: string
    price_hint?: string
  }>
  products?: Array<{
    name: string
    description: string
    price_hint?: string
  }>

  // Who they serve
  locations_served: string[]          // geo markets
  ideal_customers: string[]           // "practice owners", "homeowners"
  company_size_targets?: string[]     // "SMBs", "enterprise"

  // Positioning
  primary_value_prop: string          // single strongest claim
  differentiators: string[]
  brand_voice: string[]               // "professional", "friendly", "direct"

  // Proof
  testimonials: Array<{
    quote: string
    attribution?: string
  }>
  metrics: string[]                   // "300% ROI", "50% faster"
  client_logos: string[]

  // Sales signals
  booking_link?: string
  contact_methods: string[]           // "phone", "form", "email", "chat"
  cta_phrases: string[]               // exact CTAs from site
  pricing_found: string[]             // quoted prices or ranges
  offers_detected: string[]           // named packages, tiers

  // Agent-usable intelligence
  pain_points_inferred: string[]      // problems the business solves
  objections_inferred: string[]       // likely prospect hesitations
  competitor_mentions: string[]
  keywords: string[]                  // key industry terms they use

  // Audit
  pages_used: string[]                // source URLs
  unknowns: string[]                  // "No pricing found", "No case studies"
  confidence: 'high' | 'medium' | 'low'
  last_crawled_at: string             // ISO timestamp
}
```

---

## Phase 3: Storage

### Supabase Tables

```sql
-- Main profile
CREATE TABLE business_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        TEXT UNIQUE NOT NULL,
  company_name  TEXT,
  profile       JSONB NOT NULL,       -- full BusinessProfile
  brief         TEXT NOT NULL,        -- compressed agent-ready brief
  status        TEXT DEFAULT 'pending', -- pending|processing|ready|failed
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Individual pages for deeper retrieval
CREATE TABLE business_pages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID REFERENCES business_profiles(id),
  url           TEXT NOT NULL,
  title         TEXT,
  content       TEXT,                 -- clean markdown
  embedding     VECTOR(1536),         -- for semantic search
  crawled_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON business_profiles (domain);
CREATE INDEX ON business_pages (business_id);
```

---

## Phase 4: Context API

### Endpoints

**POST /api/business-context/crawl**
```ts
// Request
{ domain: string, alias?: string, maxPages?: number }

// Response
{ jobId: string, status: 'queued' }
```

**GET /api/business-context/status?jobId=...**
```ts
// Response
{ jobId: string, status: 'pending'|'processing'|'ready'|'failed', progress?: number }
```

**GET /api/business-context?domain=...**
```ts
// Response — used by Vapi API Request tool during calls
{
  company_name: string
  brief: string              // 300-500 word compressed brief
  services_summary: string   // one line
  brand_tone: string         // one line
  ideal_customers: string    // one line
  booking_link?: string
  key_facts: string[]        // 5-8 bullets
}
```

**GET /api/business-context/full?domain=...**
```ts
// Full BusinessProfile JSON — for dashboard display
```

---

## Phase 5: Vapi Handoff

### Pattern A — Pre-call injection (recommended for known targets)

At outbound call creation, pass the business brief through `assistantOverrides`:

```ts
const call = await fetch('https://api.vapi.ai/call', {
  method: 'POST',
  headers: { Authorization: `Bearer ${VAPI_KEY}` },
  body: JSON.stringify({
    phoneNumberId: PHONE_ID,
    customer: { number: prospectPhone },
    assistantId: ASSISTANT_ID,
    assistantOverrides: {
      variableValues: {
        company_name:    profile.company_name,
        business_brief:  profile.brief,
        services:        profile.services_summary,
        tone:            profile.brand_voice.join(', '),
        ideal_customers: profile.ideal_customers.join(', '),
        booking_link:    profile.booking_link ?? 'not available',
      },
      model: {
        messages: [{
          role: 'system',
          content: AGENT_PROMPT_TEMPLATE   // uses {{variable}} placeholders
        }]
      }
    }
  })
})
```

### Pattern B — On-demand lookup (for unknown targets or deep questions)

Register a tool on the Vapi assistant:
```json
{
  "type": "apiRequest",
  "function": {
    "name": "get_business_context",
    "description": "Retrieve verified facts about the business from their website",
    "parameters": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "What you need to know" }
      },
      "required": ["query"]
    }
  },
  "url": "https://your-app.vercel.app/api/business-context",
  "method": "GET"
}
```

---

## Agent Prompt Template

```
You are an outbound voice representative calling on behalf of {{company_name}}.

ABOUT THE BUSINESS:
{{business_brief}}

KEY SERVICES: {{services}}
IDEAL CUSTOMERS: {{ideal_customers}}
TONE: {{tone}}

RULES:
- Sound natural. Do not read from a list.
- Never invent services, prices, guarantees, or integrations.
- If you are unsure of a specific fact, say "I can check on that and follow up."
- If the prospect asks something not covered above, call get_business_context.
- Keep responses brief — this is a phone call, not a presentation.
- Your goal: qualify interest and book a next step or demo call.

BOOKING: {{booking_link}}
```

---

## Phase 6: Post-Call Enrichment

After each call, Vapi sends an end-of-call-report to your server URL. Extract:

```ts
interface CallOutcome {
  call_id: string
  business_id: string
  prospect_number: string
  duration_seconds: number
  outcome: 'interested' | 'not_interested' | 'callback_requested' | 'no_answer' | 'voicemail'
  pain_points_mentioned: string[]
  objections_raised: string[]
  next_step?: string
  booking_confirmed: boolean
  follow_up_needed: boolean
  notes: string                    // 2-3 sentence summary
}
```

Store in Supabase → surface in dashboard.

---

## Deliverables

| # | Deliverable | Notes |
|---|-------------|-------|
| 1 | Crawl job API (`POST /api/business-context/crawl`) | Queue-based, async |
| 2 | Extractor LLM pass | Claude, outputs strict BusinessProfile JSON |
| 3 | `business_profiles` + `business_pages` Supabase tables | With pgvector for semantic search |
| 4 | Context API (`GET /api/business-context`) | Used by Vapi tool during calls |
| 5 | Vapi session builder | Builds `assistantOverrides` with brief injected |
| 6 | `get_business_context` tool registered on Vapi | API Request type |
| 7 | Post-call outcome extractor | Webhook handler → structured output → Supabase |
| 8 | Dashboard page `/dashboard/business-context` | Shows profile, pages crawled, call outcomes |

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Crawler | Firecrawl (`/map` + `/crawl`) | JS rendering, clean markdown, async delivery |
| Extractor | Claude claude-opus-4-6 | Best structured JSON extraction |
| Storage | Supabase + pgvector | Already in stack, handles JSON + embeddings |
| API | Next.js API routes (this repo) | Already deployed to Vercel |
| Agent | Vapi (existing assistant) | Already configured |
| Queue | Supabase `business_profiles.status` + polling | Simple, no extra infra |

---

## Guardrails

- Only crawl publicly accessible pages (no auth bypass)
- Respect `robots.txt` crawl-delay directives
- Cap crawl at 50 pages max per domain
- Rate limit: 1 domain crawl per 60 seconds per account
- Store source URLs with every extracted fact for auditability
- Mark uncertain facts in `unknowns[]` — never invent
- Brief must be ≤600 words — enforce in compression step
- Never pass raw HTML to Vapi — clean markdown only

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time from domain input to ready brief | < 90 seconds |
| Brief accuracy (spot-check vs site) | > 90% |
| Agent hallucination rate on business facts | < 5% of calls |
| Crawl cost per domain | < $0.10 (Firecrawl + LLM combined) |
| Pages crawled per domain (avg) | 10–20 |

---

## Open Questions

1. **Firecrawl vs self-hosted crawler** — Firecrawl has a free tier but rate limits; for high volume, self-host with Playwright or use a simpler fetch + cheerio stack for static sites
2. **Brief update cadence** — crawl once on onboarding, re-crawl weekly? On-demand refresh button?
3. **Multi-language support** — if the business site is not in English, translate before extraction?
4. **Competitor context** — should we also crawl 1-2 competitor sites for comparison talking points?
5. **Authorization** — should users need to verify domain ownership, or is it open to any public domain?
