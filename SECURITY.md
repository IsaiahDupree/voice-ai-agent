# Security Guide

## Overview

This guide covers security best practices for deploying and operating your Voice AI Agent system.

## Authentication & Authorization

### API Key Management

**Generate secure API keys:**
```javascript
// Use cryptographically secure random generator
import crypto from 'crypto';

const apiKey = `vaa_${crypto.randomBytes(32).toString('hex')}`;
// Result: vaa_a1b2c3d4e5f6...
```

**Store hashed keys in database:**
```javascript
import crypto from 'crypto';

function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// When creating API key
const apiKey = generateApiKey();
const hashedKey = hashApiKey(apiKey);
await db.insert('api_keys', { key_hash: hashedKey, user_id });

// Show key to user ONCE
return { apiKey };  // Never store plaintext
```

**Validate API keys:**
```javascript
// middleware.ts
export async function authenticate(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = authHeader.substring(7);
  const hashedKey = hashApiKey(apiKey);

  const keyRecord = await db.query('SELECT * FROM api_keys WHERE key_hash = $1 AND active = true', [hashedKey]);
  if (keyRecord.rows.length === 0) {
    return Response.json({ error: 'Invalid API key' }, { status: 401 });
  }

  return keyRecord.rows[0];
}
```

### Rate Limiting

**Prevent abuse with rate limits:**

```javascript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'), // 100 requests per minute
});

export async function checkRateLimit(identifier: string) {
  const { success, limit, reset, remaining } = await ratelimit.limit(identifier);

  if (!success) {
    throw new Error('Rate limit exceeded');
  }

  return { limit, reset, remaining };
}
```

**Apply to API routes:**
```javascript
// /api/calls/outbound/route.ts
export async function POST(req: Request) {
  const apiKey = await authenticate(req);

  // Rate limit by API key
  const rateLimit = await checkRateLimit(apiKey.id);

  // Proceed with request...
}
```

**Rate limit headers:**
```javascript
return Response.json(data, {
  headers: {
    'X-RateLimit-Limit': String(rateLimit.limit),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(rateLimit.reset),
  },
});
```

## Data Protection

### PII Redaction

**Automatically redact sensitive data from transcripts:**

```javascript
// lib/pii-redaction.ts
export function redactPII(text: string): string {
  // Credit card numbers (Visa, MC, Amex, Discover)
  text = text.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CREDIT_CARD]');

  // SSN (XXX-XX-XXXX)
  text = text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');

  // Email addresses
  text = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');

  // Phone numbers (various formats)
  text = text.replace(/\b(\+?1[-.]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');

  return text;
}

// Apply to transcripts before saving
const transcript = await getTranscriptFromVapi(callId);
const redactedTranscript = redactPII(transcript);
await db.insert('transcripts', { call_id: callId, content: redactedTranscript });
```

### Encryption at Rest

**Encrypt sensitive fields in database:**

```javascript
// lib/encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32-byte key
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// Usage:
const encryptedPhone = encrypt('+15551234567');
await db.insert('contacts', { phone_number: encryptedPhone });

// When retrieving:
const contact = await db.query('SELECT * FROM contacts WHERE id = $1', [id]);
const phone = decrypt(contact.phone_number);
```

**Generate encryption key:**
```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
# Add to .env.local:
# ENCRYPTION_KEY=a1b2c3d4e5f6...
```

## HTTPS & Network Security

### Force HTTPS

**Redirect HTTP to HTTPS:**

```javascript
// middleware.ts
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && req.headers.get('x-forwarded-proto') !== 'https') {
    return NextResponse.redirect(`https://${req.headers.get('host')}${req.nextUrl.pathname}`, 301);
  }

  return NextResponse.next();
}
```

### CORS Configuration

**Restrict origins:**

```javascript
// middleware.ts
const ALLOWED_ORIGINS = [
  'https://your-app.vercel.app',
  'https://admin.yourcompany.com',
];

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');

  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return Response.json({ error: 'CORS policy violation' }, { status: 403 });
  }

  const res = NextResponse.next();
  res.headers.set('Access-Control-Allow-Origin', origin || ALLOWED_ORIGINS[0]);
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return res;
}
```

### Security Headers

**Add security headers:**

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
          },
        ],
      },
    ];
  },
};
```

## Database Security

### Row Level Security (RLS)

**Enable RLS on Supabase tables:**

```sql
-- Enable RLS
ALTER TABLE voice_agent_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY "Users can view their own calls"
  ON voice_agent_calls
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calls"
  ON voice_agent_calls
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role bypasses RLS (for server-side operations)
-- Use SUPABASE_SERVICE_ROLE_KEY for admin operations
```

### SQL Injection Prevention

**Always use parameterized queries:**

```javascript
// ❌ BAD: SQL injection vulnerable
const phone = req.query.phone;
const result = await db.query(`SELECT * FROM contacts WHERE phone_number = '${phone}'`);

// ✅ GOOD: Parameterized query
const phone = req.query.phone;
const result = await db.query('SELECT * FROM contacts WHERE phone_number = $1', [phone]);
```

### Database Connection Security

**Use connection pooling:**

```javascript
// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'x-application-name': 'voice-ai-agent',
      },
    },
  }
);
```

## Webhook Security

### Verify Webhook Signatures

**Validate webhooks are from trusted sources:**

```javascript
// /api/webhooks/vapi/route.ts
import crypto from 'crypto';

export async function POST(req: Request) {
  const signature = req.headers.get('x-vapi-signature');
  const body = await req.text();

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.VAPI_WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');

  if (signature !== expectedSignature) {
    console.error('[Webhook] Invalid signature');
    return Response.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Process webhook...
  const payload = JSON.parse(body);
  // ...
}
```

### Idempotency

**Prevent duplicate webhook processing:**

```javascript
// /api/webhooks/vapi/route.ts
export async function POST(req: Request) {
  const payload = await req.json();
  const idempotencyKey = req.headers.get('x-webhook-id') || payload.id;

  // Check if already processed
  const existing = await db.query('SELECT * FROM webhook_logs WHERE idempotency_key = $1', [idempotencyKey]);
  if (existing.rows.length > 0) {
    console.log('[Webhook] Already processed:', idempotencyKey);
    return Response.json({ message: 'Already processed' }, { status: 200 });
  }

  // Process webhook...
  await processWebhook(payload);

  // Log webhook
  await db.insert('webhook_logs', {
    idempotency_key: idempotencyKey,
    endpoint: '/api/webhooks/vapi',
    payload,
    processed_at: new Date(),
  });

  return Response.json({ success: true }, { status: 200 });
}
```

## Access Control

### Role-Based Access (Future)

**Define user roles:**

```typescript
enum Role {
  ADMIN = 'admin',        // Full access
  MANAGER = 'manager',    // Manage campaigns, view all data
  AGENT = 'agent',        // View assigned calls only
  READONLY = 'readonly',  // View-only access
}

// Middleware to check permissions
export async function requireRole(req: Request, allowedRoles: Role[]) {
  const user = await authenticate(req);

  if (!allowedRoles.includes(user.role)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return user;
}

// Usage:
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await requireRole(req, [Role.ADMIN, Role.MANAGER]);

  // Delete campaign...
}
```

## Compliance & Audit Logging

### Audit Logs

**Log all sensitive operations:**

```javascript
// lib/audit-logger.ts
export async function logAudit(event: {
  user_id: string;
  action: string;
  resource: string;
  resource_id?: string;
  metadata?: any;
}) {
  await db.insert('audit_logs', {
    user_id: event.user_id,
    action: event.action,
    resource: event.resource,
    resource_id: event.resource_id,
    metadata: event.metadata,
    ip_address: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    timestamp: new Date(),
  });
}

// Usage:
await logAudit({
  user_id: user.id,
  action: 'DELETE',
  resource: 'campaign',
  resource_id: campaignId,
  metadata: { campaign_name: campaign.name },
});
```

**Query audit logs:**
```sql
-- Recent deletions
SELECT * FROM audit_logs WHERE action = 'DELETE' ORDER BY timestamp DESC LIMIT 50;

-- User activity
SELECT action, COUNT(*) FROM audit_logs WHERE user_id = 'user123' GROUP BY action;
```

### GDPR Compliance

**Data export (Right to Access):**

```javascript
// /api/users/[id]/export/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await authenticate(req);

  if (user.id !== params.id && user.role !== Role.ADMIN) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Export all user data
  const data = {
    user: await db.query('SELECT * FROM users WHERE id = $1', [params.id]),
    contacts: await db.query('SELECT * FROM contacts WHERE user_id = $1', [params.id]),
    calls: await db.query('SELECT * FROM voice_agent_calls WHERE user_id = $1', [params.id]),
    transcripts: await db.query('SELECT * FROM transcripts WHERE user_id = $1', [params.id]),
  };

  return Response.json(data, {
    headers: {
      'Content-Disposition': `attachment; filename="user_data_${params.id}.json"`,
    },
  });
}
```

**Data deletion (Right to be Forgotten):**

```javascript
// /api/users/[id]/route.ts
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  await requireRole(req, [Role.ADMIN]);

  // Delete all user data
  await db.query('DELETE FROM voice_agent_calls WHERE user_id = $1', [params.id]);
  await db.query('DELETE FROM contacts WHERE user_id = $1', [params.id]);
  await db.query('DELETE FROM campaigns WHERE user_id = $1', [params.id]);
  await db.query('DELETE FROM users WHERE id = $1', [params.id]);

  return Response.json({ success: true });
}
```

## Secret Management

### Environment Variables

**Never commit secrets:**

```bash
# .gitignore
.env
.env.local
.env*.local
.vercel
```

**Use Vercel for production secrets:**

```bash
vercel env add VAPI_API_KEY production
vercel env add OPENAI_API_KEY production
# ...
```

### Rotate Secrets

**Quarterly rotation schedule:**

| Secret | Rotation Frequency | Who Rotates |
|--------|-------------------|-------------|
| API keys | Every 90 days | DevOps team |
| Database passwords | Every 180 days | DBA |
| Encryption keys | Every 365 days | Security team |
| Webhook secrets | After any breach | DevOps team |

**Rotation checklist:**
- [ ] Generate new secret
- [ ] Update environment variables
- [ ] Redeploy application
- [ ] Test with new secret
- [ ] Delete old secret after 24-hour grace period

## Incident Response

### Security Breach Protocol

**If credentials are compromised:**

1. **Immediately rotate all API keys**
   ```bash
   # Generate new keys in all services
   # Update Vercel env vars
   vercel env rm VAPI_API_KEY
   vercel env add VAPI_API_KEY
   # Redeploy
   vercel --prod
   ```

2. **Audit logs for unauthorized access**
   ```sql
   SELECT * FROM audit_logs WHERE timestamp > NOW() - INTERVAL '7 days' ORDER BY timestamp DESC;
   ```

3. **Contact affected users** (if data exposed)

4. **File incident report**

5. **Review and patch vulnerability**

### DDoS Protection

**Use Vercel's built-in protection:**
- Automatic DDoS mitigation
- Rate limiting at edge
- Bot detection

**Additional protection:**
```javascript
// Rate limit aggressive behavior
const { success } = await ratelimit.limit(`ip:${req.ip}`);
if (!success) {
  return Response.json({ error: 'Too many requests' }, { status: 429 });
}
```

## Security Checklist

### Pre-Deployment

- [ ] All secrets in environment variables (not code)
- [ ] HTTPS enforced
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] API key authentication working
- [ ] Database RLS policies applied
- [ ] PII redaction enabled
- [ ] Webhook signature verification enabled
- [ ] Security headers set
- [ ] Audit logging enabled

### Post-Deployment

- [ ] Monitor audit logs daily
- [ ] Review access logs weekly
- [ ] Rotate API keys quarterly
- [ ] Run security scan (npm audit, Snyk)
- [ ] Test authentication edge cases
- [ ] Review CORS policy monthly
- [ ] Check for outdated dependencies

### Monitoring

- [ ] Set up alerts for failed auth attempts
- [ ] Monitor rate limit violations
- [ ] Track API key usage
- [ ] Alert on database connection spikes
- [ ] Monitor webhook failures

## Tools & Services

### Security Scanning

- **npm audit**: Check for known vulnerabilities
  ```bash
  npm audit
  npm audit fix
  ```

- **Snyk**: Continuous vulnerability monitoring
  ```bash
  npx snyk test
  ```

- **OWASP ZAP**: Web application security scanner

### Monitoring

- **Sentry**: Error tracking and monitoring
- **LogRocket**: Session replay for debugging
- **Datadog**: Infrastructure monitoring

### Compliance

- **GDPR**: Data protection (EU)
- **CCPA**: Privacy rights (California)
- **HIPAA**: Healthcare data (if applicable)
- **TCPA**: Telemarketing compliance

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Vercel Security](https://vercel.com/docs/security)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
