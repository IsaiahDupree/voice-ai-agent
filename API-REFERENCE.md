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

## MCP Bridge (Feature 164)

### Overview

The MCP (Model Context Protocol) Bridge allows Vapi function tools to call any registered MCP server. This enables the voice agent to:
- Execute database queries via Supabase MCP
- Access calendar events via Calendar MCP
- Send emails via Gmail MCP
- Call any custom MCP server registered in the tenant's registry

### MCP Tool Bridge

#### POST /api/tools/mcp-bridge
Call an MCP server tool during a Vapi call

**Headers:**
- `x-current-tenant-id` (optional): Tenant ID (defaults to 'default')
- `Content-Type: application/json`

**Request Body:**
```json
{
  "server": "supabase",
  "tool": "execute_sql",
  "params": {
    "query": "SELECT * FROM contacts WHERE phone_number = '+15551234567'"
  },
  "tenant_id": "default"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "result": [
    {
      "id": 1,
      "full_name": "John Doe",
      "phone_number": "+15551234567",
      "email": "john@example.com"
    }
  ],
  "server": "supabase",
  "tool": "execute_sql"
}
```

**Error Response:** `404 Not Found`
```json
{
  "error": "MCP server 'supabase' not found or not active for tenant"
}
```

**Error Response:** `500 Internal Server Error`
```json
{
  "error": "MCP Error: Connection timeout",
  "server": "supabase",
  "tool": "execute_sql"
}
```

#### GET /api/tools/mcp-bridge
List registered MCP servers and their tools

**Query Parameters:**
- `tenant_id` (optional): Tenant ID (default: 'default')
- `server` (optional): Get details for specific server

**Response (all servers):**
```json
{
  "servers": [
    {
      "id": "uuid-1",
      "server_name": "supabase",
      "server_url": "http://localhost:3100/mcp",
      "status": "active",
      "enabled_tools": ["execute_sql", "list_tables", "apply_migration"],
      "last_health_check_at": "2026-04-04T10:00:00Z"
    },
    {
      "id": "uuid-2",
      "server_name": "calendar",
      "server_url": "http://localhost:3200/mcp",
      "status": "active",
      "enabled_tools": ["list_events", "create_event", "delete_event"],
      "last_health_check_at": "2026-04-04T10:00:00Z"
    }
  ],
  "count": 2
}
```

**Response (specific server):**
```json
{
  "server": {
    "name": "supabase",
    "url": "http://localhost:3100/mcp",
    "status": "active",
    "enabled_tools": ["execute_sql", "list_tables", "apply_migration"]
  },
  "health": {
    "status": "healthy",
    "latency_ms": 45,
    "last_check": "2026-04-04T10:00:00Z"
  }
}
```

### MCP Registry Management

#### GET /api/mcp/registry
List all registered MCP servers for a tenant

**Query Parameters:**
- `tenant_id` (required): Tenant ID

**Response:**
```json
{
  "servers": [
    {
      "id": "uuid-1",
      "server_name": "supabase",
      "server_url": "http://localhost:3100/mcp",
      "auth_type": "api_key",
      "enabled_tools": ["execute_sql", "list_tables"],
      "status": "active",
      "description": "Supabase database MCP server",
      "created_at": "2026-04-04T08:00:00Z"
    }
  ]
}
```

#### POST /api/mcp/registry
Register a new MCP server

**Request Body:**
```json
{
  "tenant_id": "default",
  "server_name": "custom-api",
  "server_url": "https://api.example.com/mcp",
  "auth_type": "bearer_token",
  "auth_config": {
    "token": "bearer_token_here"
  },
  "enabled_tools": ["search", "create", "update"],
  "description": "Custom API MCP server"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid-3",
  "server_name": "custom-api",
  "status": "active",
  "created_at": "2026-04-04T10:30:00Z"
}
```

#### POST /api/mcp/test
Test an MCP tool call

**Request Body:**
```json
{
  "tenant_id": "default",
  "server": "supabase",
  "tool": "execute_sql",
  "params": {
    "query": "SELECT 1"
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "result": [{ "?column?": 1 }],
  "latency_ms": 45
}
```

#### GET /api/mcp/tools/:server
List available tools for a specific MCP server

**Path Parameters:**
- `server`: MCP server name

**Query Parameters:**
- `tenant_id` (required): Tenant ID

**Response:**
```json
{
  "server": "supabase",
  "tools": [
    {
      "name": "execute_sql",
      "description": "Execute a SQL query",
      "inputSchema": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "SQL query to execute"
          }
        },
        "required": ["query"]
      }
    },
    {
      "name": "list_tables",
      "description": "List all tables in the database",
      "inputSchema": {
        "type": "object",
        "properties": {}
      }
    }
  ]
}
```

### Vapi Function Tool Integration

The MCP bridge is exposed as a Vapi function tool named `callMCPTool`:

**Function Definition:**
```typescript
{
  type: 'function',
  function: {
    name: 'callMCPTool',
    description: 'Call any registered MCP server tool. Use this to execute database queries, access calendars, or call other backend services.',
    parameters: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'MCP server name (e.g., "supabase", "calendar")'
        },
        tool: {
          type: 'string',
          description: 'Tool name to call (e.g., "execute_sql", "list_events")'
        },
        params: {
          type: 'object',
          description: 'Parameters to pass to the tool (tool-specific)'
        }
      },
      required: ['server', 'tool']
    }
  }
}
```

**Example Usage in Call:**

Agent: "Let me look up your account information."

*Agent calls tool:*
```json
{
  "function": "callMCPTool",
  "arguments": {
    "server": "supabase",
    "tool": "execute_sql",
    "params": {
      "query": "SELECT * FROM customers WHERE phone = '+15551234567'"
    }
  }
}
```

*Tool returns:*
```json
{
  "success": true,
  "result": [
    {
      "id": 123,
      "name": "Jane Smith",
      "account_number": "ACC-789",
      "status": "active"
    }
  ]
}
```

Agent: "I found your account, Jane. Your account number is ACC-789 and your account is active."

### Supported MCP Servers

#### Supabase MCP
**Server Name:** `supabase`
**Tools:**
- `execute_sql`: Run SQL queries
- `list_tables`: Get database tables
- `get_table_schema`: Get table structure
- `apply_migration`: Apply database migration
- `list_migrations`: List applied migrations

#### Calendar MCP (Google Calendar)
**Server Name:** `calendar`
**Tools:**
- `list_events`: Get calendar events
- `get_event`: Get event details
- `create_event`: Create new event
- `update_event`: Modify event
- `delete_event`: Remove event
- `find_free_slots`: Find available time slots

#### Gmail MCP
**Server Name:** `gmail`
**Tools:**
- `send_email`: Send email
- `search_emails`: Search inbox
- `get_email`: Get email details
- `list_labels`: Get Gmail labels

### MCP Protocol (JSON-RPC 2.0)

All MCP servers use JSON-RPC 2.0 over HTTP.

**Request Format:**
```json
{
  "jsonrpc": "2.0",
  "id": 123456789,
  "method": "tools/call",
  "params": {
    "name": "execute_sql",
    "arguments": {
      "query": "SELECT * FROM users"
    }
  }
}
```

**Success Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 123456789,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Query executed successfully"
      }
    ]
  }
}
```

**Error Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 123456789,
  "error": {
    "code": -32602,
    "message": "Invalid params: 'query' is required"
  }
}
```

### Security & Authentication

MCP servers support multiple auth types:

1. **None**: No authentication required
2. **API Key**: Custom header with API key
   ```json
   {
     "auth_type": "api_key",
     "auth_config": {
       "header_name": "X-API-Key",
       "api_key": "your_api_key_here"
     }
   }
   ```

3. **Bearer Token**: OAuth-style bearer token
   ```json
   {
     "auth_type": "bearer_token",
     "auth_config": {
       "token": "your_bearer_token"
     }
   }
   ```

4. **Basic Auth**: Username + password
   ```json
   {
     "auth_type": "basic",
     "auth_config": {
       "username": "user",
       "password": "pass"
     }
   }
   ```

### Error Handling

The MCP bridge handles errors gracefully:

1. **Connection Timeout**: Returns error after 10 seconds
2. **Invalid Tool**: Returns `404` if tool not in enabled_tools
3. **MCP Server Error**: Returns MCP error message
4. **Invalid JSON-RPC**: Returns parse error

All errors include:
- `error`: Human-readable error message
- `server`: Server name that failed
- `tool`: Tool name that failed
