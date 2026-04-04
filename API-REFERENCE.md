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

### DTMF Menus

DTMF (Dual-Tone Multi-Frequency) menu endpoints for interactive voice response (IVR) configuration.

#### GET /api/dtmf/menus
List all DTMF menus

**Query Parameters:**
- `tenant_id` (optional): Filter by tenant
- `active` (optional): Filter by active status

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "tenant_id": "default",
      "name": "Main IVR Menu",
      "description": "Primary customer service menu",
      "active": true,
      "created_at": "2026-03-28T10:00:00Z"
    }
  ]
}
```

#### POST /api/dtmf/menus
Create new DTMF menu

**Request Body:**
```json
{
  "name": "Appointment Confirmation Menu",
  "description": "Menu for confirming/rescheduling appointments",
  "menu_tree": {
    "root": {
      "message": "Press 1 to confirm, 2 to reschedule, 3 for more options",
      "options": {
        "1": {
          "action": "webhook",
          "destination": "/api/tools/confirmAppointment",
          "message": "Your appointment is confirmed"
        },
        "2": {
          "action": "menu",
          "node_id": "reschedule_menu"
        },
        "3": {
          "action": "transfer",
          "destination": "+15551234567",
          "message": "Transferring to a representative"
        }
      }
    },
    "reschedule_menu": {
      "message": "Press 1 for tomorrow, 2 for next week",
      "options": {
        "1": {
          "action": "webhook",
          "destination": "/api/tools/rescheduleTomorrow"
        },
        "2": {
          "action": "webhook",
          "destination": "/api/tools/rescheduleNextWeek"
        }
      }
    }
  },
  "timeout_seconds": 10,
  "max_retries": 3,
  "invalid_message": "Invalid selection. Please try again.",
  "timeout_message": "I didn't hear your selection."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "tenant_id": "default",
    "name": "Appointment Confirmation Menu",
    "menu_tree": { ... },
    "timeout_seconds": 10,
    "max_retries": 3,
    "active": true,
    "created_at": "2026-03-28T10:00:00Z"
  }
}
```

#### GET /api/dtmf/menus/:id
Get DTMF menu by ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Appointment Confirmation Menu",
    "menu_tree": {
      "root": { ... }
    },
    "timeout_seconds": 10,
    "max_retries": 3,
    "active": true
  }
}
```

#### PUT /api/dtmf/menus/:id
Update DTMF menu

**Request Body:**
```json
{
  "menu_tree": {
    "root": { ... }
  },
  "timeout_seconds": 15,
  "active": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "updated_at": "2026-03-28T11:00:00Z"
  }
}
```

#### DELETE /api/dtmf/menus/:id
Delete DTMF menu

**Response:**
```json
{
  "success": true,
  "message": "Menu deleted successfully"
}
```

#### POST /api/dtmf/validate
Validate DTMF menu tree structure

**Request Body:**
```json
{
  "menu_tree": {
    "root": {
      "message": "Press 1",
      "options": {
        "1": {
          "action": "transfer",
          "destination": "+15551234567"
        }
      }
    }
  }
}
```

**Response:**
```json
{
  "valid": true,
  "errors": []
}
```

**Response (invalid tree):**
```json
{
  "valid": false,
  "errors": [
    "Node \"root\" references non-existent node \"missing_node\"",
    "Transfer action in node \"menu1\" key \"1\" missing destination",
    "Invalid DTMF key \"a\" in node \"root\". Must be 0-9, *, or #"
  ]
}
```

#### POST /api/tools/handleDTMF
Process DTMF keypress (Vapi function tool)

**Request Body:**
```json
{
  "call_id": "vapi-call-123",
  "menu_id": 1,
  "keypress": "1",
  "session_state": {
    "current_node": "root",
    "collected_input": {},
    "retry_count": 0
  }
}
```

**Response:**
```json
{
  "valid": true,
  "action": {
    "action": "webhook",
    "destination": "/api/tools/confirmAppointment",
    "message": "Your appointment is confirmed"
  },
  "message": "Your appointment is confirmed",
  "session_state": {
    "current_node": "root",
    "retry_count": 0,
    "last_keypress_at": "2026-03-28T10:00:00Z"
  }
}
```

**Response (invalid keypress):**
```json
{
  "valid": false,
  "action": null,
  "message": "Invalid selection. Please try again.",
  "session_state": {
    "current_node": "root",
    "retry_count": 1
  }
}
```

### DTMF Action Types

| Action | Description | Required Fields | Example |
|--------|-------------|-----------------|---------|
| `transfer` | Transfer call to phone number | `destination` (phone number) | `{ "action": "transfer", "destination": "+15551234567", "message": "Transferring..." }` |
| `menu` | Navigate to another menu node | `node_id` | `{ "action": "menu", "node_id": "support_menu" }` |
| `collect_input` | Collect keypad input (PIN, account number) | `type` (`pin`, `account_number`, `numeric`, `confirmation`) | `{ "action": "collect_input", "type": "pin", "length": 4 }` |
| `webhook` | Call external webhook | `destination` (URL) | `{ "action": "webhook", "destination": "https://api.example.com/hook" }` |
| `end_call` | End the call | None | `{ "action": "end_call", "message": "Goodbye" }` |

### DTMF Input Types

| Type | Description | Validation | Example Use Case |
|------|-------------|------------|------------------|
| `pin` | 4-8 digit PIN | Length: 4-8 digits | Security verification |
| `account_number` | 8-16 digit account number | Length: 8-16 digits | Account lookup |
| `numeric` | Generic numeric input | Any length (configurable) | Reference numbers |
| `confirmation` | Yes/No confirmation | Must be "1" or "2" | Appointment confirmation |

### DTMF Menu Tree Structure

```typescript
interface DTMFMenuNode {
  message: string;               // Message to play when entering this node
  options?: {                    // Keypress options
    [key: string]: DTMFAction;   // Key must be 0-9, *, or #
  };
  timeout_message?: string;      // Custom timeout message for this node
  invalid_message?: string;      // Custom invalid key message for this node
}

interface DTMFAction {
  action: 'transfer' | 'menu' | 'collect_input' | 'end_call' | 'webhook';
  destination?: string;          // Phone number (transfer) or URL (webhook)
  node_id?: string;              // Target node ID (menu action)
  type?: 'account_number' | 'pin' | 'numeric' | 'confirmation';
  length?: number;               // Expected input length
  min_length?: number;           // Minimum input length
  max_length?: number;           // Maximum input length
  message?: string;              // Confirmation message
  metadata?: Record<string, unknown>;
}
```

### DTMF Best Practices

1. **Keep menus shallow**: Max 3 levels deep
2. **Limit options**: 5-7 options per menu (cognitive load)
3. **Use star (*) for help**: Standard convention
4. **Use hash (#) for back/repeat**: Standard convention
5. **Always provide timeout handling**: Set `timeout_seconds` to 8-12 seconds
6. **Test circular references**: Use `/api/dtmf/validate` before deployment
7. **Provide escape hatches**: Always include option to transfer to human (e.g., "0" for operator)

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
