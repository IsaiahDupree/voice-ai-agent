# Webhook Event Reference

## Vapi Webhooks

### Endpoint
`POST /api/webhooks/vapi`

### Authentication
Vapi signs all webhook requests with `x-vapi-signature` header. Verify signature before processing.

### Event Types

#### call-started
Sent when a call begins

```json
{
  "call": {
    "id": "call-123",
    "status": "in-progress",
    "phone_number": "+15555551234",
    "persona_id": 1
  },
  "message": {
    "type": "call-started",
    "timestamp": "2026-03-28T10:00:00Z"
  }
}
```

#### amd-result
Answering Machine Detection result

```json
{
  "call": {
    "id": "call-123"
  },
  "message": {
    "type": "amd-result",
    "amdResult": "machine" | "human" | "unknown" | "timeout"
  }
}
```

**Actions:**
- `machine`: Drop voicemail message
- `human`: Continue with conversation
- `unknown`: Proceed with caution
- `timeout`: Continue with conversation

#### function-called
AI agent called a function tool

```json
{
  "call": {
    "id": "call-123"
  },
  "message": {
    "type": "function-called",
    "functionName": "bookAppointment",
    "args": {
      "datetime": "2026-03-29T14:00:00Z",
      "duration": 30
    },
    "result": {
      "success": true,
      "bookingId": "cal-abc123"
    }
  }
}
```

#### transcript-saved
Call transcript is ready

```json
{
  "call": {
    "id": "call-123"
  },
  "message": {
    "type": "transcript-saved",
    "transcript": "Agent: Hi...\nUser: Hello...",
    "summary": "Scheduled appointment for March 29"
  }
}
```

#### call-ended
Call has completed

```json
{
  "call": {
    "id": "call-123",
    "status": "completed"
  },
  "message": {
    "type": "call-ended",
    "endReason": "hangup" | "voicemail" | "error" | "timeout",
    "duration": 120,
    "outcome": "booking_made" | "interested" | "not_interested" | "no_answer"
  }
}
```

## Cal.com Webhooks

### Endpoint
`POST /api/webhooks/calcom`

### Event Types

#### booking.created
New appointment booked

```json
{
  "event": "booking.created",
  "payload": {
    "id": 123,
    "uid": "abc123",
    "title": "Consultation",
    "startTime": "2026-03-29T14:00:00Z",
    "endTime": "2026-03-29T14:30:00Z",
    "attendees": [
      {
        "name": "John Doe",
        "email": "john@example.com",
        "phoneNumber": "+15555551234"
      }
    ]
  }
}
```

#### booking.cancelled
Appointment cancelled

```json
{
  "event": "booking.cancelled",
  "payload": {
    "id": 123,
    "uid": "abc123",
    "cancellation_reason": "Rescheduling"
  }
}
```

#### booking.rescheduled
Appointment rescheduled

```json
{
  "event": "booking.rescheduled",
  "payload": {
    "id": 123,
    "uid": "abc123",
    "oldStartTime": "2026-03-29T14:00:00Z",
    "newStartTime": "2026-03-30T10:00:00Z"
  }
}
```

## Twilio Webhooks

### Endpoint
`POST /api/webhooks/twilio`

### Event Types

#### SMS Received
Incoming SMS message

```json
{
  "MessageSid": "SM123",
  "From": "+15555551234",
  "To": "+15555555678",
  "Body": "STOP",
  "NumMedia": "0"
}
```

**Auto-handled:**
- `STOP`: Add to DNC list
- `START`: Remove from DNC list

#### SMS Delivery Status
SMS delivery confirmation

```json
{
  "MessageSid": "SM123",
  "MessageStatus": "delivered" | "failed" | "undelivered",
  "ErrorCode": "30005"
}
```

## Webhook Retry Logic

All webhooks support automatic retries:
- Initial attempt
- Retry after 1 minute (if 5xx error)
- Retry after 5 minutes
- Retry after 30 minutes
- Final retry after 2 hours

After 4 failed retries, webhook is marked as failed and alert is sent.

## Webhook Security

### Signature Verification

Vapi webhooks include `x-vapi-signature` header:

```typescript
import crypto from 'crypto'

function verifyVapiSignature(payload: string, signature: string): boolean {
  const secret = process.env.VAPI_WEBHOOK_SECRET
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
```

### Idempotency

All webhooks include `idempotency_key` to prevent duplicate processing:

```json
{
  "idempotency_key": "evt_abc123_20260328100000"
}
```

Store processed keys in database with TTL of 24 hours.

## Testing Webhooks

Use webhook testing tools:
- **Local development**: ngrok or localtunnel
- **Staging**: Vercel preview deployments
- **Production**: Monitor via `/api/monitoring/uptime`

## Webhook Logs

All webhook requests are logged to Supabase:

```sql
SELECT * FROM webhook_logs
WHERE endpoint = '/api/webhooks/vapi'
ORDER BY created_at DESC
LIMIT 100;
```

Fields: `id`, `endpoint`, `payload`, `response_status`, `processing_time_ms`, `created_at`
