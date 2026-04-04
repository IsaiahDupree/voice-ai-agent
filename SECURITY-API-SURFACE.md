# Security API Surface Documentation
## F1481: Pen test readiness - API surface documented for security review

This document outlines all API endpoints, authentication mechanisms, and security considerations for penetration testing and security review.

## Authentication

### API Key Authentication
- **Header**: `x-api-key: your-api-key`
- **Scopes**: calls:read, calls:write, contacts:read, contacts:write, campaigns:read, campaigns:write, sms:send, admin:all
- **Rate Limiting**: 100 requests/minute per API key
- **IP Allowlist**: Optional IP restriction per API key

### Webhook Authentication
- **Header**: `x-vapi-signature: sha256-hmac-signature`
- **Secret**: Configured per webhook, rotatable with 24h grace period
- **Payload**: Entire request body as string

## API Endpoints

### Public Endpoints (No Auth Required)
- `GET /api/health` - Health check
- `POST /api/webhooks/vapi` - Vapi webhook receiver (signature required)
- `POST /api/webhooks/twilio` - Twilio webhook receiver
- `POST /api/webhooks/calcom` - Cal.com webhook receiver

### Authenticated Endpoints

#### Calls
- `GET /api/calls` - List calls (scope: calls:read)
- `GET /api/calls/:id` - Get call details (scope: calls:read)
- `POST /api/calls/manual-dial` - Initiate outbound call (scope: calls:write)
- `GET /api/calls/export` - Export calls to CSV (scope: calls:read)

#### Contacts
- `GET /api/contacts` - List contacts (scope: contacts:read)
- `POST /api/contacts` - Create contact (scope: contacts:write)
- `GET /api/contacts/:id` - Get contact (scope: contacts:read, PII logged)
- `PATCH /api/contacts/:id` - Update contact (scope: contacts:write, PII logged)
- `DELETE /api/contacts/:id` - Delete contact (scope: contacts:write)
- `GET /api/contacts/:id/export` - GDPR data export (scope: admin:all)
- `POST /api/contacts/:id/delete-gdpr` - GDPR erasure (scope: admin:all)

#### Campaigns
- `GET /api/campaigns` - List campaigns (scope: campaigns:read)
- `POST /api/campaigns` - Create campaign (scope: campaigns:write)
- `POST /api/campaigns/:id/start` - Start campaign (scope: campaigns:write)
- `POST /api/campaigns/notes` - Update campaign notes (scope: campaigns:write)

#### SMS
- `POST /api/sms/send` - Send single SMS (scope: sms:send)
- `POST /api/sms/bulk` - Send bulk SMS (scope: sms:send)
- `GET /api/sms/opt-out-export` - Export opt-out list (scope: admin:all)

#### A/B Tests
- `GET /api/ab-tests` - List A/B tests (scope: calls:read)
- `POST /api/ab-tests` - Create A/B test (scope: admin:all)

#### Analytics
- `GET /api/analytics/calls` - Call analytics (scope: calls:read)
- `GET /api/analytics/campaigns` - Campaign analytics (scope: campaigns:read)

#### Admin Only (scope: admin:all)
- `GET /api/errors/dashboard` - Error monitoring dashboard
- `POST /api/errors/dashboard` - Silence/unsilence errors
- `POST /api/vapi/assistant/background-music` - Update assistant config
- `GET /api/numbers/locality` - Search phone numbers
- `POST /api/numbers/locality` - Purchase phone number

## Security Mechanisms

### Rate Limiting
- API: 100 requests/minute per API key
- Inbound calls: 10 calls/hour per phone number
- Webhooks: 100 events/minute

### Circuit Breakers
- Cal.com: Opens after 5 consecutive failures
- Twilio: Opens after 5 consecutive failures
- Vapi: Opens after 5 consecutive failures
- Timeout: 60 seconds before half-open

### PII Protection
- All PII access is logged (user_id, contact_id, fields, action, timestamp)
- PII redaction in transcripts before storage
- GDPR-compliant data export and deletion
- Data retention enforced (365 days default)

### Bot Detection
- Multiple calls in < 1 minute flagged
- Sequential number patterns blocked
- SIP scanner patterns blocked
- > 10 calls/hour flagged as spam

### MFA
- TOTP-based (30 second window)
- 10 backup codes per user
- Optional for admin accounts

### API Key Security
- SHA-256 hashed keys
- Scoped permissions
- IP allowlist support
- Last used tracking
- 90-day inactivity expiration
- Weekly usage audit emails

## Known Limitations

1. Circuit breakers are in-memory (reset on restart)
2. Rate limiting is per-instance (not distributed)
3. TOTP implementation simplified (use library in production)
4. No API versioning
5. No request signing for API calls (only webhooks)

## Sensitive Data Storage

### Database (Supabase)
- Contacts: name, email, phone, company, notes
- Calls: transcript, recording_url, from/to numbers
- SMS: body, phone numbers
- Bookings: attendee name, email, phone

### PII Retention
- Recording URLs: Deleted after retention period
- Transcripts: Redacted PII, archived after retention period
- Contact data: Can be exported/deleted per GDPR

## Recommended Pen Test Scope

1. Authentication bypass attempts
2. API key enumeration
3. SQL injection in query parameters
4. XSS in dashboard (if React app tested)
5. SSRF via webhook URLs
6. Rate limit bypass
7. Authorization escalation
8. PII access without logging
9. Webhook signature forgery
10. Circuit breaker denial of service

## Out of Scope

- DDoS attacks
- Physical security
- Social engineering
- Third-party service vulnerabilities (Vapi, Twilio, Cal.com)
