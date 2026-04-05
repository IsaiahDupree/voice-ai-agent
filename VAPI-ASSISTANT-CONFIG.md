# Vapi Assistant Configuration
**Pulled:** 2026-04-04 via GET /assistant + /phone-number

---

## Assistant

| Field | Value |
|-------|-------|
| **ID** | `e7a5dd0c-6426-4001-a02b-f01c9811bedf` |
| **Name** | Calendar Assistant |
| **Org ID** | `71fb0289-33ea-478d-b241-c4223b6de4d9` |
| **Created** | 2025-04-03 |
| **Updated** | 2025-04-19 |

---

## Model

| Field | Value |
|-------|-------|
| **Provider** | OpenAI |
| **Model** | `gpt-4.1` |
| **System prompt** | `chill friend` |

---

## Voice

| Field | Value |
|-------|-------|
| **Provider** | vapi |
| **Voice ID** | `Elliot` |

---

## Transcriber (Deepgram)

| Field | Value |
|-------|-------|
| **Provider** | deepgram |
| **Model** | nova-3 |
| **Language** | en |
| **Endpointing** | 150ms |
| **Confidence threshold** | 0.4 |
| **Numerals** | false |

---

## Call Behavior

| Field | Value |
|-------|-------|
| **First message** | `"Hey whats up"` |
| **Voicemail message** | `"hey whats up"` |
| **End call message** | `"Thanks"` |
| **End call phrases** | `goodbye`, `talk to you soon` |
| **HIPAA enabled** | false |
| **Backchanneling** | false |
| **Background denoising** | false |

---

## Speaking Plan

| Field | Value |
|-------|-------|
| **Wait before speaking** | 0.4s |
| **Smart endpointing** | livekit |
| **Idle timeout** | 15s |
| **Silence timeout message** | `"I notice you've been quiet. Would you like me to go through your upcoming meetings again, or is there anything else I can help you with regarding your calendar?"` |

### Idle Messages (cycles through these)
1. `"I'm still here if you need any help with your calendar."`
2. `"Do you need any assistance with your upcoming meetings?"`
3. `"Would you like me to remind you about any appointments?"`
4. `"I can help you schedule or reschedule any meetings if needed."`

### Stop-Speaking Acknowledgement Phrases
`i understand`, `i see`, `i got it`, `i hear you`, `im listening`, `im with you`, `right`, `okay`, `ok`, `sure`, `alright`, `got it`, `understood`

---

## Messages

### Client messages (sent to frontend)
`transcript`, `hang`, `function-call`, `speech-update`, `metadata`, `transfer-update`, `conversation-update`, `workflow.node.started`

### Server messages (sent to webhook)
`end-of-call-report`, `status-update`, `hang`, `function-call`

---

## Metadata (custom)

```json
{
  "capabilities": ["meeting_notifications", "schedule_management", "reminder_setting"],
  "assistantType": "calendar",
  "preferredGreeting": "calendar_assistant",
  "defaultMeetingReminder": 15
}
```

---

## Voicemail Detection

| Field | Value |
|-------|-------|
| **Provider** | openai |
| **Expected duration** | 15s |

---

## Phone Number

| Field | Value |
|-------|-------|
| **ID** | `2b8ea3fe-ef7b-4653-b6af-5af20f3054c2` |
| **Number** | `+13219866241` |
| **Provider** | vapi |
| **Status** | active |
| **Assigned assistant** | `e7a5dd0c-6426-4001-a02b-f01c9811bedf` (Calendar Assistant) |
| **Fallback number** | `+12177996721` |
| **Name** | Unlabeled |

---

## What Needs to Be Updated

| Setting | Current | Recommended |
|---------|---------|-------------|
| System prompt | `"chill friend"` | Full voice receptionist prompt |
| Voice | Elliot (vapi) | ElevenLabs `k0HDiJKO5QdXkGN6NSLI` |
| First message | `"Hey whats up"` | Professional greeting |
| End call message | `"Thanks"` | Full sign-off |
| Server URL | not set | Set to your webhook endpoint |
| Phone number name | Unlabeled | Give it a label |

---

## API Reference

```bash
# Get assistant
curl -X GET "https://api.vapi.ai/assistant/e7a5dd0c-6426-4001-a02b-f01c9811bedf" \
  -H "Authorization: Bearer $VAPI_API_KEY"

# Update assistant
curl -X PATCH "https://api.vapi.ai/assistant/e7a5dd0c-6426-4001-a02b-f01c9811bedf" \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": {"model": "gpt-4o", "provider": "openai", "messages": [{"role": "system", "content": "YOUR PROMPT"}]}}'

# Get phone number
curl -X GET "https://api.vapi.ai/phone-number/2b8ea3fe-ef7b-4653-b6af-5af20f3054c2" \
  -H "Authorization: Bearer $VAPI_API_KEY"

# List all calls
curl -X GET "https://api.vapi.ai/call?assistantId=e7a5dd0c-6426-4001-a02b-f01c9811bedf" \
  -H "Authorization: Bearer $VAPI_API_KEY"
```
