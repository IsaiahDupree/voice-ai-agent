# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Browser    │  │  Mobile App  │  │  Phone Call  │          │
│  │  Dashboard   │  │   (future)   │  │   (PSTN)     │          │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘          │
│         │                                     │                  │
└─────────┼─────────────────────────────────────┼──────────────────┘
          │                                     │
          │ HTTPS                               │ SIP/WebRTC
          │                                     │
┌─────────┴─────────────────────────────────────┴──────────────────┐
│                      Application Layer                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js App (Vercel)                        │   │
│  │                                                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐       │   │
│  │  │ Dashboard  │  │ API Routes │  │ Webhooks   │       │   │
│  │  │ UI Pages   │  │ /api/*     │  │ /api/hooks │       │   │
│  │  └────────────┘  └────────────┘  └────────────┘       │   │
│  │                                                          │   │
│  │  Middleware: Auth, CORS, Rate Limit, Logging           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  External Service Integrations (lib/)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │   Vapi   │ │  Twilio  │ │ Cal.com  │ │OpenAI/   │          │
│  │  Client  │ │  Client  │ │  Client  │ │Anthropic │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└───────────────────────────────────────────────────────────────────┘
          │                 │                │            │
          │ API calls       │ SMS/calls      │ Calendar   │ LLM
          │                 │                │            │
┌─────────┴─────────────────┴────────────────┴────────────┴─────────┐
│                    External Services Layer                         │
│                                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Vapi.ai │  │  Twilio  │  │ Cal.com  │  │  OpenAI  │        │
│  │  Voice   │  │   SMS    │  │Scheduling│  │   GPT    │        │
│  │  WebRTC  │  │  PSTN    │  │  Webhooks│  │  Claude  │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                    │
│  ┌──────────┐  ┌──────────┐                                      │
│  │ElevenLabs│  │ Deepgram │                                      │
│  │   TTS    │  │   STT    │                                      │
│  └──────────┘  └──────────┘                                      │
└────────────────────────────────────────────────────────────────────┘
          │
          │ PostgreSQL Protocol
          │
┌─────────┴──────────────────────────────────────────────────────────┐
│                         Data Layer                                  │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                   Supabase PostgreSQL                         │ │
│  │                                                               │ │
│  │  Tables:                                                      │ │
│  │  • voice_agent_calls      • contacts                         │ │
│  │  • campaigns              • campaign_contacts                │ │
│  │  • personas               • transcripts                      │ │
│  │  • bookings               • webhook_logs                     │ │
│  │                                                               │ │
│  │  Features: RLS, Real-time subscriptions, Storage            │ │
│  └───────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Next.js Application (Vercel)
- **Frontend Dashboard**: React UI for call monitoring, campaign management, analytics
- **API Routes**: RESTful endpoints for all CRUD operations
- **Webhooks**: Receives events from Vapi, Cal.com, Twilio
- **Middleware**: Authentication, CORS, rate limiting, request logging
- **Serverless Functions**: Edge/Node.js functions for API handlers

### Vapi.ai (Voice Orchestration)
- Real-time voice call management
- WebRTC connection handling
- LLM integration (GPT-4o, Claude)
- Function tool execution
- Call recording and transcription coordination
- Transfer and forwarding logic

### Supabase (Database + Auth)
- PostgreSQL database for all persistent data
- Row Level Security (RLS) for multi-tenant access
- Real-time subscriptions for live dashboard updates
- Storage for call recordings (future)
- Authentication (future, currently API key only)

### Twilio
- SMS delivery for booking confirmations and follow-ups
- PSTN phone number management (future)
- SMS opt-out handling

### Cal.com
- Calendar availability checking
- Appointment booking
- Webhook notifications for booking events
- Timezone-aware scheduling

### LLM Providers
- **OpenAI GPT-4o**: Default reasoning model
- **Anthropic Claude**: Alternative reasoning model
- Dynamic model selection per persona

### ElevenLabs (TTS)
- Natural voice synthesis
- Multiple voice options per persona
- Low-latency streaming audio

### Deepgram (STT)
- Real-time speech-to-text transcription
- Word-level timestamps
- Multi-language support

### LLM Evaluation Pipeline (F96-F105)
- **Automatic Call Quality Assessment**: GPT-4o acts as judge to evaluate every completed call
- **Multi-Dimensional Scoring**: 5 core metrics (goal achievement, naturalness, objection handling, information accuracy, overall)
- **Actionable Feedback**: Failure point identification, improvement suggestions, and prompt change recommendations
- **Real-Time Dashboard**: Live evaluation trends, common failure patterns, and aggregated improvement insights
- **Fire-and-Forget Architecture**: Evaluations triggered asynchronously on call-ended webhook to avoid blocking

#### Evaluation Process
1. Call ends with transcript (length > 50 chars)
2. Webhook handler triggers `evaluateCall()` async (no await)
3. GPT-4o analyzes transcript against call goal:
   - Parse conversation structure and flow
   - Assess goal achievement (boolean + 0-10 score)
   - Rate naturalness of agent responses
   - Evaluate objection handling effectiveness
   - Judge information accuracy
   - Calculate overall score (average of 4 metrics)
   - Extract failure points and improvement opportunities
   - Recommend specific prompt changes
4. Store evaluation in `call_evaluations` table
5. Dashboard displays scores in CallDetailDrawer + Evaluation page

#### Evaluation Schema
```typescript
interface CallEvaluation {
  call_id: string
  goal_achieved: boolean              // Did the agent achieve the stated goal?
  goal_achievement_score: number      // 0-10 rating
  naturalness_score: number           // 0-10 rating
  objection_handling_score: number    // 0-10 rating
  information_accuracy_score: number  // 0-10 rating
  overall_score: number               // Average of above 4 scores
  failure_points: string[]            // Specific moments that went wrong
  improvement_suggestions: string[]   // What to do differently
  highlight_moments: string[]         // Things the agent did well
  recommended_prompt_changes: string[] // Suggested system prompt updates
  evaluator_model: string             // 'gpt-4o'
  evaluation_duration_ms: number      // How long evaluation took
  transcript_length: number           // Character count
  call_duration_seconds: number       // Call length
  created_at: timestamp
  tenant_id: string                   // Multi-tenant isolation
}
```

#### Dashboard Features
- **/dashboard/evaluation**: Aggregate trends, score breakdown charts (Recharts), top failure patterns, improvement recommendations
- **EvalScoreCard**: Detailed per-call view with all 5 scores, color-coded by performance (green ≥8, yellow ≥6, orange ≥4, red <4)
- **FailurePatternsList**: Aggregated failure points across calls, sorted by frequency, with occurrence counts
- **PromptImprovementSuggestor**: Categorized suggestions (tone, clarity, completeness, handling), one-click copy to clipboard, apply-to-prompt workflow

#### API Endpoints
```
POST /api/evaluation/trigger        # Manually trigger evaluation
GET  /api/evaluation/:call_id       # Get evaluation for specific call
GET  /api/evaluation/aggregate      # Get aggregate stats (date range, tenant)
GET  /api/evaluation/failing-calls  # Get calls below score threshold
POST /api/evaluation/batch          # Evaluate last N calls
```

#### Benefits
- **Rapid Iteration**: Identify prompt weaknesses within minutes of deployment
- **Data-Driven Optimization**: Quantify impact of each prompt change via before/after scores
- **Quality Assurance**: Flag low-scoring calls for manual review
- **Customer Insights**: Aggregate failure patterns reveal systemic UX issues

## Data Flow Patterns

### Outbound Call Flow
1. User creates campaign with contact list
2. User starts campaign via API or dashboard
3. System queues contacts for calling
4. For each contact:
   - Create call record in DB (status: queued)
   - Lookup contact details
   - Call Vapi API to initiate call
   - Update call record (status: ringing → in-progress → completed)
   - Vapi executes function tools during call
   - Save transcript after call ends
   - Send SMS follow-up if booking made

### Inbound Call Flow
1. PSTN caller dials Vapi-assigned number
2. Vapi webhook triggers `/api/webhooks/vapi`
3. System creates call record
4. Lookup caller by phone number
5. Personalize greeting with caller name
6. Agent handles call with configured persona
7. Save transcript and outcome
8. Send SMS confirmation if needed

### Booking Flow
1. Agent calls `checkCalendar` function tool
2. System queries Cal.com API for availability
3. Agent offers time slots to caller
4. Caller confirms preferred time
5. Agent calls `bookAppointment` function tool
6. System creates booking via Cal.com API
7. Cal.com webhook confirms booking
8. System saves booking record
9. SMS confirmation sent to caller

### Webhook Processing
All webhooks follow idempotent processing:
1. Extract idempotency key from payload
2. Check if already processed (webhook_logs table)
3. If duplicate, return 200 immediately
4. Process webhook payload
5. Update database records
6. Log webhook to webhook_logs
7. Return 200 OK

### Real-Time Transcript Streaming Flow (F113-F120)

```
┌──────────────┐         ┌─────────────────┐        ┌──────────────────┐
│   Vapi.ai    │         │  Next.js API    │        │    Supabase      │
│  (Call in    │         │  /api/webhooks  │        │  live_transcripts│
│  Progress)   │         │  /transcript    │        │     table        │
└──────┬───────┘         └────────┬────────┘        └────────┬─────────┘
       │                          │                          │
       │ 1. Transcript chunk      │                          │
       │ (speaker, text, time)    │                          │
       ├─────────────────────────>│                          │
       │                          │                          │
       │                          │ 2. INSERT chunk          │
       │                          ├─────────────────────────>│
       │                          │                          │
       │                          │                          │ 3. Realtime
       │                          │                          │ broadcast
       │                          │                          │ (< 100ms)
       │                          │                          │
       │                          │                          │
┌──────┴───────┐         ┌────────┴────────┐        ┌────────┴─────────┐
│  Dashboard   │<────────│ SSE Endpoint    │<───────│ Supabase         │
│  (Browser)   │ 4. SSE  │ /api/transcripts│        │ Realtime Channel │
│              │ stream  │ /live/:callId   │        │                  │
└──────┬───────┘         └─────────────────┘        └──────────────────┘
       │
       │ 5. Render in LiveTranscriptDrawer
       │ - Speaker labels (agent/caller)
       │ - Sentiment indicators
       │ - Auto-scroll to latest
       │ - Call stage visualization
       │
       v
┌──────────────────────────────────────────────────────────────┐
│                  Live Call Dashboard                         │
│                                                              │
│  ┌────────────────────────────┐  ┌──────────────────────┐  │
│  │  LiveCallsPanel            │  │ LiveTranscriptDrawer │  │
│  │  - Active calls (2s poll)  │  │ - Real-time chunks   │  │
│  │  - Green pulsing indicator │  │ - Sentiment bar      │  │
│  │  - Duration counter        │  │ - Call stage flow    │  │
│  └────────────────────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Latency breakdown (F120):**
- Vapi webhook → API receive: < 100ms
- Database INSERT: < 300ms
- Supabase Realtime broadcast: < 500ms
- SSE delivery to browser: < 100ms
- **Total end-to-end: < 1000ms** (well under 2s requirement)

**Components:**
- `LiveCallsPanel`: Polls `/api/calls/active` every 2 seconds, displays active calls
- `LiveTranscriptDrawer`: Connects via SSE to `/api/transcripts/live/:callId`
- `LiveSentimentBar`: Real-time positive/neutral/negative distribution
- `CallStageIndicator`: Greeting → Discovery → Pitch → Objections → Close

**Database tables:**
- `live_transcripts`: Stores transcript chunks with sequence numbers
- `voice_agent_calls`: Call metadata (status, timestamps, phone numbers)

**Advantages:**
- Sub-second latency for live monitoring
- No polling overhead (SSE push model)
- Automatic reconnection on network issues
- Scales to thousands of concurrent calls via Supabase Realtime

## Deployment Architecture

### Vercel (Production)
- Edge network for low-latency API responses
- Automatic HTTPS and CDN
- Environment variables for secrets
- Automatic deployments from GitHub main branch

### Supabase (Production)
- Managed PostgreSQL with automatic backups
- Connection pooling via PgBouncer
- Read replicas for analytics queries (future)

### Environment Separation
- **Production**: Live customer calls, real billing
- **Staging**: Pre-production testing (future, see DEPLOYMENT.md)
- **Development**: Local Next.js dev server + Supabase

## Security Architecture

### API Authentication
- API key in `Authorization: Bearer {key}` header
- Rate limiting: 100 req/min per IP, 1000 req/hr per key
- CORS whitelist for dashboard domain

### Database Security
- Row Level Security (RLS) policies on all tables
- Encrypted connections (SSL/TLS)
- No direct database access from clients
- All queries via API routes

### PII Protection
- Phone numbers stored in E.164 format
- Call recordings encrypted at rest (future)
- Transcript redaction for credit cards, SSNs (implemented)
- Compliance logging for TCPA

### Secrets Management
- All secrets in Vercel environment variables
- Never committed to git
- Rotated quarterly (recommended)

## Scalability Considerations

### Current Capacity
- Vercel: 100 GB-hours per month (Hobby plan)
- Supabase: 500 MB database, 1 GB egress (Free plan)
- Vapi: Pay-per-minute, unlimited concurrency
- Expected capacity: ~10,000 calls/month

### Bottlenecks
1. **Database connections**: Supabase connection limit (50 on free tier)
   - Mitigation: Connection pooling via PgBouncer
2. **API rate limits**: Vapi, Cal.com, Twilio all have rate limits
   - Mitigation: Exponential backoff, request queuing
3. **Transcript storage**: Large text fields grow quickly
   - Mitigation: Archive old transcripts to S3 (future)

### Horizontal Scaling
- Vercel auto-scales serverless functions
- Supabase can upgrade to larger instances
- Add caching layer (Redis) for frequently accessed data (future)

## Monitoring and Observability

### Health Checks
- `/api/health`: Checks all external service connectivity
- Supabase connection pool status
- Vapi API reachability
- Twilio account balance

### Logging
- All API requests logged via middleware
- Webhook payloads saved to `webhook_logs`
- Error tracking via console (future: Sentry integration)

### Metrics (future)
- Call duration distribution
- Booking conversion rate
- API response times
- Error rates by endpoint

## Technology Choices

### Why Next.js?
- Fast development with App Router
- Serverless functions for API routes
- Excellent Vercel deployment experience
- React for dynamic dashboard UI

### Why Vapi.ai?
- Handles complex voice orchestration
- Built-in LLM integration
- WebRTC reliability
- No need to manage Twilio webhooks directly

### Why Supabase?
- PostgreSQL with real-time subscriptions
- Generous free tier
- Excellent DX with auto-generated types
- Row Level Security for multi-tenancy

### Why Cal.com?
- Open source, self-hostable (future)
- Simple API for availability + booking
- Webhook support for booking events
- Timezone-aware scheduling

## Visual Conversation Flow Builder

The Flow Builder is a visual tool for designing conversation state machines without code. Built with ReactFlow, it enables drag-and-drop conversation design that exports directly to Vapi assistant configurations.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Flow Builder UI                           │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Flow List    │  │ReactFlow     │  │ Node Palette │     │
│  │ Sidebar      │  │ Canvas       │  │ (drag nodes) │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  Custom Node Components:                                    │
│  • SpeakNode       • ListenNode      • ConditionNode       │
│  • ToolNode        • TransferNode    • EndNode             │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ Save/Export/Simulate
                       │
┌──────────────────────┴───────────────────────────────────────┐
│                    Flow Engine                               │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  lib/flow-export.ts                                 │    │
│  │  • Validate flow structure                          │    │
│  │  • Generate system prompt from nodes                │    │
│  │  • Extract function tools                           │    │
│  │  • Export to Vapi assistant config JSON             │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │  lib/flow-simulator.ts                              │    │
│  │  • Text-based conversation simulation               │    │
│  │  • Mock tool execution                              │    │
│  │  • Intent extraction & branching logic              │    │
│  │  • Variable interpolation                           │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ REST API
                       │
┌──────────────────────┴───────────────────────────────────────┐
│                    Flow API Routes                           │
│                                                              │
│  • POST   /api/flows               - Create flow            │
│  • GET    /api/flows               - List flows             │
│  • GET    /api/flows/:id           - Get flow               │
│  • PUT    /api/flows/:id           - Update flow            │
│  • DELETE /api/flows/:id           - Delete flow            │
│  • POST   /api/flows/:id/export    - Export to Vapi        │
│  • POST   /api/flows/:id/simulate  - Test flow             │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ PostgreSQL
                       │
┌──────────────────────┴───────────────────────────────────────┐
│               Supabase: conversation_flows                   │
│                                                              │
│  • id, tenant_id, name, description                         │
│  • nodes (JSONB) - ReactFlow node array                     │
│  • edges (JSONB) - ReactFlow edge array                     │
│  • version (auto-incremented on nodes/edges change)         │
│  • vapi_assistant_id, is_active                             │
│  • created_at, updated_at                                   │
└─────────────────────────────────────────────────────────────┘
```

### Node Types

| Node Type | Purpose | Key Properties |
|-----------|---------|----------------|
| **SpeakNode** | Agent speaks a message | `message` (supports {{variables}}) |
| **ListenNode** | Listen for caller response | `expected_intents`, `timeout_seconds` |
| **ConditionNode** | Branch based on condition | `condition` expression, true/false handles |
| **ToolNode** | Call a function (Vapi or MCP) | `tool_type`, `tool_name`, `parameters`, `store_result_as` |
| **TransferNode** | Transfer to human/external | `transfer_type`, `destination` |
| **EndNode** | End conversation | `end_reason` (success/failure/timeout/hangup) |

### Flow Export Process

1. **Validation**: Check for entry node, orphaned nodes, valid structure
2. **Traversal**: DFS from entry node, generate step-by-step instructions
3. **System Prompt**: Convert flow graph → natural language instructions for LLM
4. **Tool Extraction**: Identify all ToolNodes → Vapi function tool configs
5. **Assistant Config**: Combine prompt + tools + voice settings → Vapi JSON
6. **Vapi API Call** (optional): Create assistant in Vapi, store assistant ID

### Flow Simulation

Simulation runs flows in a test environment before deployment:

```typescript
// Example simulation
const result = await simulateConversationFlow(
  flow,
  ['yes', 'tomorrow at 2pm', 'john@example.com'], // Mock user inputs
  { caller_name: 'John', caller_phone: '+15555555555' } // Context
)

// Result:
{
  flow_name: 'Appointment Booking',
  total_steps: 8,
  final_outcome: 'success',
  steps: [
    { node_type: 'speak', agent_message: 'Hello John...' },
    { node_type: 'listen', user_input: 'yes', extracted_intent: 'affirmative' },
    { node_type: 'tool', tool_call: { tool_name: 'checkCalendar', result: {...} } },
    ...
  ]
}
```

### Multi-Tenant Isolation

- Each tenant has separate flows (via `tenant_id` FK)
- Row Level Security policies enforce isolation
- Flows can share MCP tool bridges (via `mcp_registry`)
- Version control: auto-increment on every nodes/edges change

### Integration with Vapi

Exported flows create Vapi assistants with:
- **System prompt**: Generated from flow graph traversal
- **Function tools**: Extracted from ToolNodes
- **First message**: From entry SpeakNode
- **Voice settings**: Default or per-node overrides
- **Model**: GPT-4o (configurable)

### Example Use Cases

1. **Appointment Booking**: Speak → Listen → Check Calendar (ToolNode) → Confirm → Book (ToolNode) → End
2. **Support Routing**: Speak → Listen → Condition (intent check) → Transfer to dept A/B/C
3. **Lead Qualification**: Multi-step listen/speak with scoring ToolNode → Condition → Transfer or End
4. **Knowledge Base Q&A**: Speak → Listen → RAG Search (ToolNode) → Speak answer → End

### Benefits

- **No-code conversation design** for non-technical users
- **Visual debugging**: See conversation paths at a glance
- **Reusable flows**: Clone and modify existing flows
- **Version control**: Track changes over time
- **Testable**: Simulate before deploying to production
- **Export portability**: JSON config works with any Vapi account

## Future Architecture Improvements

1. **Redis caching**: Cache Cal.com availability for 5 minutes
2. **Background job queue**: Bull/BullMQ for async tasks (SMS sending, transcript processing)
3. **CDN for recordings**: CloudFront + S3 for call recording storage
4. **Analytics pipeline**: Export call data to BigQuery for advanced analytics
5. **Multi-region**: Deploy edge functions in multiple regions for global coverage
