# Voice AI Agent

An AI-powered phone agent system built on Vapi.ai for 24/7 inbound/outbound calls, appointment booking, and CRM integration.

## Features

- ✅ Real-time voice conversations via Vapi.ai + WebRTC
- ✅ Multiple LLM support (GPT-4o, Claude Sonnet)
- ✅ Natural voice synthesis via ElevenLabs
- ✅ Appointment booking via Cal.com API
- ✅ SMS follow-ups via Twilio
- ✅ Call logging and transcripts in Supabase
- ✅ Dashboard for call history and analytics

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Voice**: Vapi.ai (orchestration) + ElevenLabs (TTS) + Deepgram (STT)
- **LLM**: OpenAI GPT-4o / Anthropic Claude Sonnet
- **Database**: Supabase (ivhfuhxorppptyuofbgq)
- **Integrations**: Cal.com (scheduling), Twilio (SMS)
- **Deployment**: Vercel

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.local` and fill in your API keys:

```bash
# Required
VAPI_API_KEY=                    # Get from vapi.ai dashboard
NEXT_PUBLIC_SUPABASE_URL=        # Already set to ivhfuhxorppptyuofbgq
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Get from Supabase dashboard
SUPABASE_SERVICE_ROLE_KEY=       # Get from Supabase dashboard

# Optional (for full functionality)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
CALCOM_API_KEY=
CALCOM_EVENT_TYPE_ID=
OPENAI_API_KEY=
ELEVENLABS_API_KEY=
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Check Health

```bash
curl http://localhost:3000/api/health
```

## API Endpoints

### Assistant Management

- `POST /api/vapi/assistant` - Create new assistant
- `GET /api/vapi/assistant` - List all assistants
- `GET /api/vapi/assistant/:id` - Get assistant by ID
- `PUT /api/vapi/assistant/:id` - Update assistant
- `DELETE /api/vapi/assistant/:id` - Delete assistant

### System

- `GET /api/health` - Health check (Vapi, Supabase, Twilio, Cal.com)

## Example: Create an Assistant

```bash
curl -X POST http://localhost:3000/api/vapi/assistant \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Assistant",
    "model": {
      "provider": "openai",
      "model": "gpt-4o",
      "temperature": 0.7
    },
    "voice": {
      "provider": "elevenlabs",
      "voiceId": "21m00Tcm4TlvDq8ikWAM"
    },
    "firstMessage": "Hi! I'\''m calling from Acme Corp. Is this a good time to chat?"
  }'
```

## Progress

**483/1500 features completed** - **32.2%**

### ✅ Core Platform Complete
- **Vapi Integration**: Full SDK, webhooks, 8 event types, error handling
- **Advanced Config**: 70+ assistant options (voicemail, transfer, metadata, etc.)
- **Phone Management**: Purchase/list/release numbers with area code selection
- **Inbound Features**: Caller ID lookup, personalization, blocklist, voicemail, callbacks, PII redaction
- **Outbound Campaigns**: Campaign CRUD, batch dialing, calling hours, day-of-week restrictions
- **Call Whisper**: Automatic context loading for agents and human reps on transfer
- **Compliance**: Immutable audit logging, PII redaction (SSN/CC/CVV), TCPA tracking
- **30+ API Endpoints**: Assistants, calls, campaigns, contacts, DNC, health
- **8 Webhook Events**: call-started/ended, function-call, transcript, status, hang, speech
- **7 Function Tools**: Calendar check/book, CRM lookup, SMS, transfer, end call, DNC opt-out
- **Safety**: Blocklist, emergency routing, spam filter, business hours, PII redaction

### Recent Additions (Session 2026-03-26)
- **F0139**: Call whisper to agent - Context loaded before first word
- **F0166**: Inbound compliance logging - Immutable audit log
- **F0172**: Call PII redaction - Auto-redact SSN/CC/CVV from transcripts
- **F0196**: DNC export - CSV download of DNC list
- **F0191/F0192**: Campaign calling hours + day-of-week restrictions

### Next Up
- Testing infrastructure (31 P0 test features pending)
- Dashboard UI (call monitoring, analytics, campaign management)
- Additional inbound features (abandonment detection, number health checks)
- Advanced analytics and reporting

See `PROGRESS.md` for detailed status.

## Deploy to Vercel

```bash
npx vercel --yes --prod
```

## License

MIT
