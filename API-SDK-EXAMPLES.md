# API SDK Examples

**F1392**: Example code for calling each API route

---

## JavaScript/TypeScript Examples

### 1. Create an Assistant

```typescript
const response = await fetch('/api/vapi/assistant', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'Sales Assistant',
    voice: 'jennifer-playht',
    firstMessage: 'Hello! How can I help you today?',
    model: {
      provider: 'openai',
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a friendly sales assistant...',
        },
      ],
    },
    tools: [
      {
        type: 'function',
        function: {
          name: 'checkCalendar',
          description: 'Check calendar availability',
          parameters: {
            type: 'object',
            properties: {
              date: { type: 'string' },
            },
          },
        },
      },
    ],
  }),
})

const assistant = await response.json()
console.log('Assistant created:', assistant.id)
```

### 2. Start an Outbound Call

```typescript
const response = await fetch('/api/calls/outbound', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    assistantId: 'asst_xxx',
    phoneNumber: '+15551234567',
    from: '+15559876543',
  }),
})

const call = await response.json()
console.log('Call started:', call.callId)
```

### 3. Fetch Call History

```typescript
const response = await fetch('/api/calls?page=1&limit=20')
const data = await response.json()

data.calls.forEach(call => {
  console.log(`${call.from_number} → ${call.to_number}: ${call.status}`)
})
```

### 4. Get Transcript

```typescript
const callId = 'call_xxx'
const response = await fetch(`/api/transcripts/${callId}`)
const transcript = await response.json()

console.log('Transcript:', transcript.transcript_text)
console.log('Sentiment:', transcript.metadata.sentiment)
console.log('Action Items:', transcript.metadata.action_items)
```

### 5. Export Transcript as SRT

```typescript
const transcriptId = 'trans_xxx'
const response = await fetch(`/api/transcripts/${transcriptId}/export?format=srt`)
const srtText = await response.text()

// Download file
const blob = new Blob([srtText], { type: 'text/srt' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `transcript-${transcriptId}.srt`
a.click()
```

### 6. Book an Appointment (via Cal.com)

```typescript
const response = await fetch('/api/calendar/booking', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    eventTypeId: 123456,
    name: 'John Doe',
    email: 'john@example.com',
    start: '2026-04-01T14:00:00Z',
    timeZone: 'America/New_York',
    metadata: {
      phone: '+15551234567',
      callId: 'call_xxx',
    },
  }),
})

const booking = await response.json()
console.log('Booking confirmed:', booking.uid)
```

### 7. Send SMS

```typescript
const response = await fetch('/api/sms/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '+15551234567',
    message: 'Your appointment is confirmed for tomorrow at 2pm!',
    from: '+15559876543', // Optional
  }),
})

const sms = await response.json()
console.log('SMS sent:', sms.sid)
```

### 8. Create or Update Contact

```typescript
const response = await fetch('/api/contacts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    phone: '+15551234567',
    name: 'Jane Smith',
    email: 'jane@example.com',
    tags: ['lead', 'interested'],
    deal_stage: 'qualified',
  }),
})

const contact = await response.json()
console.log('Contact created:', contact.id)
```

### 9. Search Contacts

```typescript
const query = 'acme corp'
const response = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}`)
const results = await response.json()

results.contacts.forEach(contact => {
  console.log(`${contact.name} - ${contact.company} (${contact.phone})`)
})
```

### 10. Get Analytics

```typescript
const response = await fetch('/api/analytics?start_date=2026-03-01&end_date=2026-03-31')
const analytics = await response.json()

console.log('Total calls:', analytics.total_calls)
console.log('Bookings:', analytics.bookings_count)
console.log('Conversion rate:', analytics.conversion_rate)
```

---

## Python Examples

### Using requests library

```python
import requests

# Create assistant
response = requests.post('http://localhost:3000/api/vapi/assistant', json={
    'name': 'Sales Assistant',
    'voice': 'jennifer-playht',
    'firstMessage': 'Hello! How can I help you today?',
    'model': {
        'provider': 'openai',
        'model': 'gpt-4o'
    }
})

assistant = response.json()
print(f"Assistant created: {assistant['id']}")

# Start outbound call
response = requests.post('http://localhost:3000/api/calls/outbound', json={
    'assistantId': assistant['id'],
    'phoneNumber': '+15551234567'
})

call = response.json()
print(f"Call started: {call['callId']}")
```

### Using httpx (async)

```python
import httpx
import asyncio

async def make_call():
    async with httpx.AsyncClient() as client:
        response = await client.post('http://localhost:3000/api/calls/outbound', json={
            'assistantId': 'asst_xxx',
            'phoneNumber': '+15551234567'
        })

        call = response.json()
        print(f"Call ID: {call['callId']}")

asyncio.run(make_call())
```

---

## cURL Examples

### Create Assistant

```bash
curl -X POST http://localhost:3000/api/vapi/assistant \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sales Assistant",
    "voice": "jennifer-playht",
    "firstMessage": "Hello! How can I help you today?"
  }'
```

### List Calls

```bash
curl http://localhost:3000/api/calls?page=1&limit=10
```

### Get Transcript

```bash
curl http://localhost:3000/api/transcripts/call_xxx
```

### Export Transcript (SRT)

```bash
curl http://localhost:3000/api/transcripts/trans_xxx/export?format=srt \
  -o transcript.srt
```

---

## Error Handling

### JavaScript

```typescript
try {
  const response = await fetch('/api/calls/outbound', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assistantId: 'xxx', phoneNumber: '+1555...' })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'API request failed')
  }

  const data = await response.json()
  console.log('Success:', data)
} catch (error) {
  console.error('Error:', error.message)
}
```

### Python

```python
import requests

try:
    response = requests.post('http://localhost:3000/api/calls/outbound', json={
        'assistantId': 'xxx',
        'phoneNumber': '+1555...'
    })

    response.raise_for_status()  # Raises HTTPError for 4xx/5xx

    data = response.json()
    print(f"Success: {data}")

except requests.exceptions.HTTPError as e:
    print(f"HTTP Error: {e.response.status_code}")
    print(f"Message: {e.response.json().get('message')}")
except requests.exceptions.RequestException as e:
    print(f"Request failed: {e}")
```

---

## Rate Limiting

All API routes support standard rate limiting. Include retry logic:

```typescript
async function callWithRetry(url: string, options: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options)

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '5'
      await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000))
      continue
    }

    return response
  }

  throw new Error('Max retries exceeded')
}
```

---

## WebSocket: Real-time Call Events

```typescript
const ws = new WebSocket('ws://localhost:3000/api/calls/stream')

ws.onopen = () => {
  console.log('Connected to call stream')
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)

  switch (data.type) {
    case 'call.started':
      console.log(`Call started: ${data.callId}`)
      break
    case 'call.ended':
      console.log(`Call ended: ${data.callId} (${data.duration}s)`)
      break
    case 'transcript.updated':
      console.log(`Transcript: ${data.text}`)
      break
  }
}

ws.onerror = (error) => {
  console.error('WebSocket error:', error)
}
```
