---
slug: voice-ai-agent
title: Voice AI Agent (Real-Time Conversational Phone Agent)
priority: high
bucket_size: 6
inspiration_repos:
  - extrawest/vapi_personal_assistant_voice_agent
  - Agentic-Insights/voice-bot
  - sshh12/llm_convo
---

# Voice AI Agent — Project in a Box

## Problem
Upwork clients in the voice_ai_agent bucket (6 jobs) need AI phone agents that can handle inbound/outbound calls, qualify leads, book appointments, or handle support — 24/7, sounding natural, with real CRM integration.

## Solution
A complete Voice AI Agent system built on Vapi.ai + Claude/GPT-4o + Supabase. Deploys in minutes, handles real phone calls, books appointments via Cal.com, logs everything to CRM, and sends SMS follow-ups via Twilio.

## Target Upwork Client
- Sales teams wanting automated outbound SDR calls at scale
- Clinics/services needing 24/7 appointment booking over phone
- Support teams handling high inbound call volume
- Real estate agencies qualifying leads before human handoff

## Core Value Prop
**"An AI SDR that works the phones 24/7, books meetings, and never misses a follow-up."**

## Architecture
```
Vapi.ai (real-time voice orchestration + WebRTC)
       ↓
LLM (GPT-4o / Claude) — reasoning + responses
Deepgram (STT) / ElevenLabs (TTS)
       ↓
Function Tools:
  - checkCalendar (Cal.com)
  - bookAppointment (Cal.com)
  - lookupContact (Supabase CRM)
  - sendSMS (Twilio)
  - transferCall (Vapi)
       ↓
Supabase (call logs, transcripts, CRM records)
Next.js Dashboard (call history, agent config, analytics)
```

## Key Features
1. **Inbound phone agent** — Vapi-powered agent answers calls with configured persona + script
2. **Outbound calling campaign** — batch dial list with configurable calling window, voicemail drop
3. **Calendar integration** — real-time availability check + booking via Cal.com API
4. **Live call dashboard** — active calls, duration, sentiment, transfer status
5. **Full call transcripts** — Deepgram word-level transcripts saved to Supabase per call
6. **SMS follow-up automation** — post-call SMS via Twilio with booking confirmation/next steps
7. **Agent persona builder** — configure name, voice (ElevenLabs), tone, script, fallbacks
8. **CRM contact lookup** — agent looks up caller by phone number, personalizes greeting
9. **Human handoff** — agent transfers to live rep when: confused, requested, or high-value signal
10. **/api/health** — checks Vapi, Twilio, Cal.com, Supabase connectivity

## Success Criteria
- Real phone call placed and answered by AI agent
- Agent books a real appointment on Cal.com calendar
- Full transcript saved to Supabase within 30s of call end
- SMS confirmation sent after booking

## Stack
- Next.js 14 (App Router) + TypeScript
- Vapi.ai (voice orchestration)
- OpenAI GPT-4o (LLM)
- ElevenLabs (TTS voice)
- Deepgram (STT)
- Cal.com API (scheduling)
- Twilio (SMS)
- Supabase (ivhfuhxorppptyuofbgq)
- Vercel
