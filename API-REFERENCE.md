# API Reference

## Authentication

All API requests require authentication via API key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

## Endpoints

### Campaigns

#### GET /api/campaigns
List all campaigns

**Query Parameters:**
- `status` (optional): Filter by status (draft, active, paused, completed)
- `limit` (optional): Max number of results (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```json
[
  {
    "id": 1,
    "name": "Q1 Outreach",
    "status": "active",
    "persona_id": 1,
    "total_contacts": 100,
    "completed_calls": 45,
    "bookings_made": 12,
    "created_at": "2026-03-01T00:00:00Z"
  }
]
```

#### POST /api/campaigns
Create a new campaign

**Request Body:**
```json
{
  "name": "Campaign Name",
  "persona_id": 1,
  "contact_list": [
    {
      "phone_number": "+15555551234",
      "full_name": "John Doe"
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "Campaign Name",
  "status": "draft",
  "created_at": "2026-03-28T00:00:00Z"
}
```

#### PATCH /api/campaigns/:id
Update campaign

**Request Body:**
```json
{
  "name": "Updated Name",
  "status": "paused"
}
```

**Response:** `200 OK`

#### POST /api/campaigns/:id/actions
Perform campaign action

**Request Body:**
```json
{
  "action": "start" | "pause" | "resume" | "stop"
}
```

**Response:** `200 OK`

### Contacts

#### GET /api/contacts
List contacts

**Query Parameters:**
- `limit`, `offset`: Pagination
- `search`: Search by name or phone

**Response:**
```json
[
  {
    "id": 1,
    "full_name": "John Doe",
    "phone_number": "+15555551234",
    "email": "john@example.com",
    "company": "Acme Inc",
    "created_at": "2026-03-28T00:00:00Z"
  }
]
```

#### POST /api/contacts
Create contact

**Request Body:**
```json
{
  "full_name": "John Doe",
  "phone_number": "+15555551234",
  "email": "john@example.com",
  "company": "Acme Inc"
}
```

**Response:** `201 Created`

### Personas

#### GET /api/personas
List all personas

#### POST /api/personas
Create persona

**Request Body:**
```json
{
  "name": "Sales Agent",
  "voice_id": "elevenlabs-voice-id",
  "system_prompt": "You are a helpful sales agent...",
  "first_message": "Hi, this is Sarah from...",
  "tools": ["checkCalendar", "bookAppointment"]
}
```

### Calls

#### POST /api/calls/outbound
Initiate outbound call

**Request Body:**
```json
{
  "phone_number": "+15555551234",
  "persona_id": 1,
  "campaign_id": 1
}
```

**Response:**
```json
{
  "call_id": "vapi-call-123",
  "status": "queued"
}
```

#### GET /api/calls/:id
Get call details

**Response:**
```json
{
  "id": "vapi-call-123",
  "status": "completed",
  "duration": 120,
  "outcome": "booking_made",
  "transcript_id": 456,
  "started_at": "2026-03-28T10:00:00Z",
  "ended_at": "2026-03-28T10:02:00Z"
}
```

### Transcripts

#### GET /api/transcripts/:id
Get call transcript

**Response:**
```json
{
  "id": 1,
  "call_id": "vapi-call-123",
  "content": "Agent: Hi, this is Sarah...\nUser: Hello...",
  "created_at": "2026-03-28T10:02:00Z"
}
```

### Health

#### GET /api/health
System health check

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-28T10:00:00Z",
  "services": {
    "vapi": { "status": "up", "responseTime": 45 },
    "supabase": { "status": "up", "responseTime": 12 },
    "twilio": { "status": "up", "responseTime": 89 },
    "calcom": { "status": "up", "responseTime": 123 }
  }
}
```

## Error Codes

- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid API key
- `404 Not Found`: Resource not found
- `409 Conflict`: Duplicate resource
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Rate Limiting

- 100 requests per minute per IP
- 1000 requests per hour per API key

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1711627200
```
