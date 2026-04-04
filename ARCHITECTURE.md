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

## Future Architecture Improvements

1. **Redis caching**: Cache Cal.com availability for 5 minutes
2. **Background job queue**: Bull/BullMQ for async tasks (SMS sending, transcript processing)
3. **CDN for recordings**: CloudFront + S3 for call recording storage
4. **Analytics pipeline**: Export call data to BigQuery for advanced analytics
5. **Multi-region**: Deploy edge functions in multiple regions for global coverage
