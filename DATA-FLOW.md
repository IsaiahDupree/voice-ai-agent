# Data Flow Diagrams

## 1. Outbound Call Campaign Flow

```
┌─────────────┐
│    User     │
│  Dashboard  │
└──────┬──────┘
       │
       │ 1. Create campaign
       │    POST /api/campaigns
       ▼
┌─────────────────┐
│   Next.js API   │
│  /api/campaigns │
└──────┬──────────┘
       │
       │ 2. Insert campaign row
       ▼
┌─────────────────┐
│   Supabase DB   │
│   campaigns     │
└──────┬──────────┘
       │
       │ 3. User clicks "Start Campaign"
       │    POST /api/campaigns/:id/actions {action: "start"}
       ▼
┌─────────────────────────┐
│  Campaign Processor     │
│  (API route handler)    │
└──────┬──────────────────┘
       │
       │ 4. Query contact list
       ▼
┌─────────────────┐
│   Supabase DB   │
│campaign_contacts│
└──────┬──────────┘
       │
       │ 5. For each contact (batched):
       ├─────────────────────┐
       │                     │
       ▼                     ▼
┌──────────────┐      ┌──────────────┐
│ Check DNC    │      │ Check time   │
│   status     │      │   zone       │
└──────┬───────┘      └──────┬───────┘
       │                     │
       │ 6. If OK to call:   │
       └─────────┬───────────┘
                 │
                 │ 7. Create call record
                 ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │voice_agent_calls│
          │ status: queued  │
          └─────────┬───────┘
                    │
                    │ 8. Initiate call via Vapi
                    │    POST vapi.ai/call
                    ▼
          ┌──────────────────┐
          │    Vapi.ai       │
          │  Call Service    │
          └─────────┬────────┘
                    │
                    │ 9. Call placed to PSTN
                    │    status: ringing
                    ▼
          ┌──────────────────┐
          │  Caller's Phone  │
          └─────────┬────────┘
                    │
                    │ 10. Caller answers
                    │     status: in-progress
                    ▼
          ┌──────────────────────┐
          │   Vapi Call Engine   │
          │  • LLM reasoning     │
          │  • Deepgram STT      │
          │  • ElevenLabs TTS    │
          │  • Function tools    │
          └─────────┬────────────┘
                    │
                    │ 11. During call:
                    │     Agent may call tools
                    ├──────────────────┐
                    │                  │
                    ▼                  ▼
          ┌──────────────┐   ┌──────────────┐
          │checkCalendar │   │bookAppointment│
          │              │   │               │
          │Cal.com API   │   │ Cal.com API  │
          └──────┬───────┘   └──────┬────────┘
                 │                  │
                 │ 12. Availability │ 12. Create booking
                 │     returned     │
                 │                  │
                 └────────┬─────────┘
                          │
                          │ 13. Call ends
                          │     status: completed
                          ▼
          ┌────────────────────────┐
          │   Vapi Webhook         │
          │ POST /api/webhooks/vapi│
          │   {call_id, transcript}│
          └─────────┬──────────────┘
                    │
                    │ 14. Save transcript
                    ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │   transcripts   │
          └─────────┬───────┘
                    │
                    │ 15. If booking made:
                    │     Send SMS confirmation
                    ▼
          ┌──────────────────┐
          │   Twilio API     │
          │   SMS send       │
          └──────────────────┘
```

## 2. Inbound Call Flow

```
┌──────────────────┐
│  Caller dials    │
│ Vapi number      │
│ +1-555-VAPI-NUM  │
└─────────┬────────┘
          │
          │ 1. Vapi receives call
          ▼
┌─────────────────────┐
│    Vapi.ai          │
│  Inbound Handler    │
└─────────┬───────────┘
          │
          │ 2. Webhook: call.started
          │    POST /api/webhooks/vapi
          ▼
┌──────────────────────┐
│   Next.js API        │
│ /api/webhooks/vapi   │
└─────────┬────────────┘
          │
          │ 3. Extract caller ID
          │    phone_number: +15551234567
          ▼
┌──────────────────────┐
│  Contact Lookup      │
│  lib/contact-lookup  │
└─────────┬────────────┘
          │
          │ 4. Query Supabase
          │    SELECT * FROM contacts
          │    WHERE phone_number = ...
          ▼
┌─────────────────┐
│   Supabase DB   │
│    contacts     │
└─────────┬───────┘
          │
          ├──────────────┬──────────────┐
          │              │              │
   Found  │              │ Not found    │
          ▼              ▼              │
  ┌────────────┐  ┌────────────────┐  │
  │Return name │  │Create new      │  │
  │company     │  │contact record  │  │
  │history     │  │                │  │
  └─────┬──────┘  └────────┬───────┘  │
        │                  │           │
        └─────────┬────────┘           │
                  │                    │
                  │ 5. Return context  │
                  │    to Vapi         │
                  ▼                    │
          ┌─────────────────┐          │
          │  Vapi Call      │          │
          │  • LLM gets     │          │
          │    caller context│         │
          │  • Personalized │          │
          │    greeting     │          │
          └─────────┬───────┘          │
                    │                  │
                    │ 6. Agent handles call
                    │    (same as outbound)
                    ▼
          ┌──────────────────┐
          │  Function tools  │
          │  • checkCalendar │
          │  • bookAppointment│
          │  • updateContact │
          │  • transferCall  │
          └─────────┬────────┘
                    │
                    │ 7. Call completed
                    │    Transcript saved
                    ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │voice_agent_calls│
          │   transcripts   │
          └─────────────────┘
```

## 3. Appointment Booking Flow

```
Agent: "I have 2pm or 4pm available. Which works for you?"
Caller: "2pm is perfect"
                    │
                    │ 1. LLM decides to book
                    │    Tool call: bookAppointment
                    ▼
          ┌──────────────────────┐
          │  Vapi Function Tool  │
          │  POST /api/tools/    │
          │       book-appointment│
          └─────────┬────────────┘
                    │
                    │ 2. Validate params:
                    │    • date/time
                    │    • contact info
                    │    • timezone
                    ▼
          ┌──────────────────────┐
          │  Next.js API Handler │
          │  lib/calcom.ts       │
          └─────────┬────────────┘
                    │
                    │ 3. Call Cal.com API
                    │    POST cal.com/api/v1/bookings
                    ▼
          ┌──────────────────────┐
          │    Cal.com API       │
          │  • Check availability│
          │  • Create booking    │
          │  • Send invites      │
          └─────────┬────────────┘
                    │
                    │ 4. Return booking UID
                    ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │    bookings     │
          │  • call_id      │
          │  • calcom_uid   │
          │  • start_time   │
          └─────────┬───────┘
                    │
                    │ 5. Return success to Vapi
                    │    {"success": true, "booking_id": 123}
                    ▼
          ┌──────────────────────┐
          │  Vapi Call Engine    │
          │  LLM receives result │
          └─────────┬────────────┘
                    │
                    │ 6. Agent confirms to caller
                    │    "Great! I've booked you for
                    │     2pm on March 28th. You'll
                    │     receive a confirmation text."
                    ▼
          ┌──────────────────────┐
          │  Call continues...   │
          └──────────────────────┘

  ────────── ASYNC ──────────

          ┌──────────────────────┐
          │  Cal.com Webhook     │
          │  booking.created     │
          │  POST /api/webhooks/ │
          │       calcom         │
          └─────────┬────────────┘
                    │
                    │ 7. Verify idempotency
                    ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │  webhook_logs   │
          └─────────┬───────┘
                    │
                    │ 8. Update booking status
                    ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │    bookings     │
          │ status: confirmed│
          └─────────┬───────┘
                    │
                    │ 9. Send SMS confirmation
                    ▼
          ┌──────────────────────┐
          │   Twilio API         │
          │  POST /Messages      │
          │                      │
          │  "Hi John, your      │
          │   appointment is     │
          │   confirmed for 2pm  │
          │   on Mar 28. Reply   │
          │   CANCEL to cancel." │
          └──────────────────────┘
```

## 4. Human Handoff Flow

```
Agent detects: confused caller OR explicit request OR high-value lead
                    │
                    │ 1. LLM decides to transfer
                    │    Tool call: transferCall
                    ▼
          ┌──────────────────────┐
          │  Vapi Function Tool  │
          │  POST /api/tools/    │
          │       transfer-call  │
          └─────────┬────────────┘
                    │
                    │ 2. Lookup transfer number
                    │    from persona config
                    ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │    personas     │
          │ transfer_number │
          └─────────┬───────┘
                    │
                    │ 3. Initiate Vapi transfer
                    │    PUT vapi.ai/call/:id/transfer
                    ▼
          ┌──────────────────────┐
          │    Vapi.ai           │
          │  Transfer Handler    │
          └─────────┬────────────┘
                    │
                    │ 4. Play hold music to caller
                    │    "Please hold while I connect you
                    │     to a team member."
                    ▼
          ┌──────────────────────┐
          │  PSTN Bridge         │
          │  Connect to human    │
          └─────────┬────────────┘
                    │
                    │ 5. Ring transfer destination
                    │    +1-555-HUMAN-1
                    ▼
          ┌──────────────────────┐
          │  Human Rep Phone     │
          └─────────┬────────────┘
                    │
                    │ 6. Human answers
                    ▼
          ┌──────────────────────┐
          │  Three-way call:     │
          │  • Caller            │
          │  • AI agent (whisper)│
          │  • Human rep         │
          └─────────┬────────────┘
                    │
                    │ 7. AI whispers context:
                    │    "Caller: John Doe,
                    │     Company: Acme Inc,
                    │     Reason: Pricing question"
                    ▼
          ┌──────────────────────┐
          │  AI disconnects      │
          │  Caller ←→ Human     │
          └─────────┬────────────┘
                    │
                    │ 8. Log transfer in DB
                    ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │voice_agent_calls│
          │ transferred_to: │
          │  +1555HUMAN1    │
          └─────────────────┘
```

## 5. SMS Follow-up Flow

```
Call ends with outcome: "booking_made"
                    │
                    │ 1. Vapi webhook: call.ended
                    ▼
          ┌──────────────────────┐
          │   Next.js API        │
          │ /api/webhooks/vapi   │
          └─────────┬────────────┘
                    │
                    │ 2. Check outcome
                    │    if outcome === "booking_made"
                    ▼
          ┌─────────────────┐
          │  SMS Template   │
          │  lib/sms-       │
          │  templates.ts   │
          └─────────┬───────┘
                    │
                    │ 3. Select template
                    │    "booking_confirmation"
                    ▼
          ┌──────────────────────┐
          │  Template Rendering  │
          │  • Insert name       │
          │  • Insert date/time  │
          │  • Insert cancel link│
          └─────────┬────────────┘
                    │
                    │ 4. Check opt-out status
                    ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │    contacts     │
          │  sms_opted_out  │
          └─────────┬───────┘
                    │
                    ├──────────────┬──────────────┐
                    │              │              │
          Opted in  │              │ Opted out    │
                    ▼              ▼              │
          ┌─────────────┐  ┌─────────────────┐  │
          │Send SMS     │  │Skip SMS         │  │
          │             │  │Log reason       │  │
          └──────┬──────┘  └─────────────────┘  │
                 │                               │
                 │ 5. Call Twilio API            │
                 │    POST /2010-04-01/          │
                 │         Accounts/{sid}/       │
                 │         Messages.json         │
                 ▼
          ┌──────────────────────┐
          │   Twilio API         │
          │  • Validate number   │
          │  • Queue message     │
          │  • Return SID        │
          └─────────┬────────────┘
                    │
                    │ 6. Log delivery in DB
                    ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │  sms_logs       │
          │  • call_id      │
          │  • twilio_sid   │
          │  • status       │
          └─────────┬───────┘
                    │
                    │ 7. Twilio delivers SMS
                    │    to caller's phone
                    ▼
          ┌──────────────────────┐
          │  Caller's Phone      │
          │  "Hi John, your      │
          │   appointment is     │
          │   confirmed..."      │
          └──────────────────────┘

  ────────── ASYNC ──────────

          ┌──────────────────────┐
          │  Twilio Webhook      │
          │  (delivery status)   │
          │  POST /api/webhooks/ │
          │       twilio         │
          └─────────┬────────────┘
                    │
                    │ 8. Update delivery status
                    ▼
          ┌─────────────────┐
          │   Supabase DB   │
          │   sms_logs      │
          │ status: delivered│
          └─────────────────┘
```

## 6. Webhook Idempotency Flow

```
External service sends webhook (e.g., Cal.com booking.created)
                    │
                    │ 1. POST /api/webhooks/calcom
                    │    Headers: X-Webhook-Id: abc123
                    ▼
          ┌──────────────────────┐
          │   Next.js Webhook    │
          │   Handler            │
          └─────────┬────────────┘
                    │
                    │ 2. Extract idempotency key
                    │    key = X-Webhook-Id || hash(payload)
                    ▼
          ┌─────────────────────────┐
          │  Check webhook_logs     │
          │  WHERE idempotency_key  │
          │  = 'abc123'             │
          └─────────┬───────────────┘
                    │
                    ├──────────────┬──────────────┐
                    │              │              │
          Found     │              │ Not found    │
                    ▼              ▼              │
          ┌─────────────┐  ┌─────────────────┐  │
          │Return 200   │  │Process webhook  │  │
          │immediately  │  │                 │  │
          │(already     │  │                 │  │
          │ processed)  │  │                 │  │
          └─────────────┘  └────────┬────────┘  │
                                    │            │
                                    │ 3. Begin transaction
                                    ▼
                          ┌──────────────────┐
                          │Update target table│
                          │(bookings, etc)   │
                          └────────┬─────────┘
                                   │
                                   │ 4. Insert webhook_logs
                                   ▼
                          ┌──────────────────┐
                          │ INSERT INTO      │
                          │ webhook_logs     │
                          │ • idempotency_key│
                          │ • payload        │
                          │ • processed_at   │
                          └────────┬─────────┘
                                   │
                                   │ 5. Commit transaction
                                   ▼
                          ┌──────────────────┐
                          │   Return 200 OK  │
                          └──────────────────┘
```

## 7. RAG (Retrieval Augmented Generation) Knowledge Base Pipeline

### 7.1 Document Ingestion Flow

```
┌─────────────┐
│    User     │
│  Dashboard  │
│  /dashboard │
│ /knowledge- │
│    base     │
└──────┬──────┘
       │
       │ 1. Upload document (PDF, DOCX, TXT, or URL)
       │    POST /api/kb/upload
       │    FormData: file + metadata
       ▼
┌─────────────────────┐
│  Next.js API Route  │
│  /api/kb/upload     │
└──────┬──────────────┘
       │
       │ 2. Validate file type & size
       │    Parse content → plain text
       ▼
┌─────────────────────┐
│  KB Ingest Library  │
│  lib/kb-ingest.ts   │
└──────┬──────────────┘
       │
       │ 3. Chunk text into segments
       │    lib/kb-chunker.ts
       │    • 500 tokens per chunk
       │    • 50 token overlap
       ▼
┌─────────────────────┐
│  Text Chunks Array  │
│  [{text, index,     │
│    tokenCount}...]  │
└──────┬──────────────┘
       │
       │ 4. Generate embeddings (batch)
       │    lib/kb-embeddings.ts
       │    → OpenAI text-embedding-3-small
       │    → 1536-dimensional vectors
       ▼
┌─────────────────────┐
│  Embeddings Array   │
│  [vector(1536)...]  │
└──────┬──────────────┘
       │
       │ 5. Store in Supabase (single transaction)
       ├────────────────────┬──────────────────────┐
       │                    │                      │
       ▼                    ▼                      ▼
┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐
│kb_documents  │  │ kb_embeddings    │  │  pgvector index │
│• title       │  │ • chunk_text     │  │  HNSW (M=16)    │
│• content     │  │ • embedding      │  │  cosine distance│
│• file_type   │  │ • document_id    │  │                 │
│• tenant_id   │  │ • tenant_id      │  │                 │
│• chunk_count │  │ • chunk_index    │  │                 │
└──────────────┘  └──────────────────┘  └─────────────────┘
```

### 7.2 Semantic Search Flow

```
┌─────────────┐
│ Voice Agent │ (during call)
│   OR        │
│   Dashboard │ (testing)
└──────┬──────┘
       │
       │ 1. User asks question:
       │    "What are your pricing plans?"
       ▼
┌─────────────────────────┐
│  Vapi Function Tool     │
│  POST /api/tools/       │
│  searchKnowledgeBase    │
└──────┬──────────────────┘
       │
       │ 2. Extract query + tenant_id
       │    Request body:
       │    {query, tenantId, limit, threshold}
       ▼
┌─────────────────────────┐
│  KB Search Library      │
│  lib/kb-search.ts       │
└──────┬──────────────────┘
       │
       │ 3. Generate query embedding
       │    OpenAI text-embedding-3-small
       │    query → vector(1536)
       ▼
┌─────────────────────────┐
│  Query Embedding        │
│  [0.123, -0.456, ...]   │
└──────┬──────────────────┘
       │
       │ 4. Vector similarity search
       │    SELECT * FROM kb_embeddings
       │    WHERE tenant_id = $1
       │    ORDER BY embedding <=> $2::vector
       │    LIMIT $3
       ▼
┌─────────────────────────┐
│  Supabase + pgvector    │
│  • HNSW index scan      │
│  • Cosine similarity    │
│  • Tenant isolation     │
└──────┬──────────────────┘
       │
       │ 5. Return top-k results
       │    [{chunkText, documentTitle,
       │      similarity, metadata}...]
       ▼
┌─────────────────────────┐
│  Format for Voice Agent │
│  {answer, sources,      │
│   confidence, context}  │
└──────┬──────────────────┘
       │
       │ 6. Return to caller
       │    Status 200
       │    JSON response
       ▼
┌─────────────────────────┐
│  Voice Agent Continues  │
│  Speaks answer to user  │
└─────────────────────────┘
```

### 7.3 Multi-Tenant Isolation

```
┌────────────────────────────────────────────┐
│           Supabase Database                │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  Tenant: "acme-corp"                 │ │
│  │  ┌────────────┐  ┌────────────────┐ │ │
│  │  │kb_documents│  │kb_embeddings   │ │ │
│  │  │tenant_id=  │──│tenant_id=      │ │ │
│  │  │"acme-corp" │  │"acme-corp"     │ │ │
│  │  └────────────┘  └────────────────┘ │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  Tenant: "startup-xyz"               │ │
│  │  ┌────────────┐  ┌────────────────┐ │ │
│  │  │kb_documents│  │kb_embeddings   │ │ │
│  │  │tenant_id=  │──│tenant_id=      │ │ │
│  │  │"startup-xyz│  │"startup-xyz"   │ │ │
│  │  └────────────┘  └────────────────┘ │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌──────────────────────────────────────┐ │
│  │  tenant_configs table                │ │
│  │  • tenant_id                         │ │
│  │  • kb_namespace                      │ │
│  │  • assistant_id                      │ │
│  │  • voice_id                          │ │
│  └──────────────────────────────────────┘ │
└────────────────────────────────────────────┘

Each tenant's KB data is:
1. Logically isolated by tenant_id column
2. Indexed separately for fast retrieval
3. Namespaced via tenant_configs.kb_namespace
4. Never cross-contaminated in search results
```

### 7.4 RAG Pipeline Performance

```
Document Upload (one-time):
  • Small doc (5 pages): ~3-5 seconds
  • Medium doc (50 pages): ~10-20 seconds
  • Large doc (200 pages): ~45-90 seconds

Search Query (real-time):
  • Embedding generation: ~200-500ms
  • pgvector search (HNSW): ~10-50ms
  • Format response: ~5ms
  • Total: ~220-560ms (sub-second)
```

## Key Data Flow Principles

1. **Idempotency**: All webhooks use idempotency keys to prevent duplicate processing
2. **Async operations**: SMS sending, transcript processing happen after call ends
3. **Transaction safety**: Database writes use transactions where multiple tables are updated
4. **Error recovery**: Failed API calls use exponential backoff and retry logic
5. **Audit logging**: All external API calls logged to `webhook_logs` and `api_logs`
6. **Multi-tenant isolation**: All KB data scoped by tenant_id, no cross-tenant leakage
7. **Vector search optimization**: pgvector HNSW index enables sub-50ms semantic search
6. **Rate limiting**: Requests queued and throttled to respect external API limits
