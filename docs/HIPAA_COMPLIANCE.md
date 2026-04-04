# HIPAA Compliance Notes

## Overview

This Voice AI Agent system can be configured for healthcare use cases (appointment scheduling, patient intake, prescription refill requests), but requires additional compliance measures to be HIPAA-compliant.

**⚠️ IMPORTANT:** This system is NOT HIPAA-compliant out of the box. You must implement the additional safeguards below.

---

## HIPAA Requirements for Voice AI Systems

### 1. Business Associate Agreements (BAAs)

You must obtain signed BAAs from all vendors handling PHI (Protected Health Information):

**Required BAAs:**
- ✅ **Vapi.ai** - Voice platform (handles call recordings, transcripts)
- ✅ **OpenAI** - LLM provider (processes conversation content) - [OpenAI offers BAA for Enterprise](https://openai.com/enterprise-privacy)
- ✅ **Anthropic** - Alternative LLM (if using Claude) - [Anthropic offers BAA](https://www.anthropic.com/legal/hipaa-baa)
- ✅ **ElevenLabs** - TTS provider (handles voice data)
- ✅ **Deepgram** - STT provider (handles voice data) - [Deepgram offers BAA](https://deepgram.com/legal/hipaa-compliance)
- ✅ **Supabase** - Database (stores call logs, transcripts, patient data) - [Supabase offers HIPAA-compliant hosting](https://supabase.com/partners/integrations/hipaa-compliance)
- ✅ **Twilio** - SMS provider (handles patient communications) - [Twilio HIPAA eligible](https://www.twilio.com/en-us/hipaa)
- ✅ **Vercel** - Hosting platform (if storing PHI on servers)
- ✅ **Cal.com** - Scheduling platform (if self-hosted or Enterprise plan with BAA)

**Action:** Contact each vendor's sales/compliance team to request BAA before processing any patient data.

---

### 2. Technical Safeguards

#### 2.1 Encryption

**At Rest:**
- ✅ Supabase encryption at rest (enabled by default on Pro plan)
- ✅ Store call recordings in encrypted S3/Supabase Storage
- ⚠️ Enable AES-256 encryption for all PHI fields

**In Transit:**
- ✅ TLS 1.2+ for all API calls (already enforced)
- ✅ WSS for WebSocket connections (Vapi default)

**Implementation:**
```typescript
// lib/encryption.ts - Already exists in codebase
import { encrypt, decrypt } from '@/lib/encryption'

// Encrypt PHI before storing in Supabase
const encryptedPhone = encrypt(phoneNumber)
const encryptedNotes = encrypt(patientNotes)
```

#### 2.2 Access Controls

- ✅ Role-based access control (RBAC) - implemented in `lib/rbac.ts`
- ⚠️ Enforce MFA for all dashboard users
- ⚠️ Audit log all PHI access - use `lib/audit-logger.ts`

**To Enable:**
```typescript
// middleware.ts - Add MFA check
import { requireMFA } from '@/lib/mfa'

export async function middleware(request: NextRequest) {
  await requireMFA(request)
  // ... rest of middleware
}
```

#### 2.3 Data Minimization

Only collect PHI that is absolutely necessary:

**Safe to collect:**
- First name (not full name if avoidable)
- Phone number (for callback only)
- Appointment date/time
- Reason for visit (general category, not detailed diagnosis)

**Avoid collecting:**
- SSN
- Detailed medical history
- Diagnosis information
- Prescription details (unless required for workflow)

**Vapi Configuration:**
```typescript
// Redact sensitive info from transcripts
const assistant = {
  transcriber: {
    provider: 'deepgram',
    keywords: ['redact:ssn', 'redact:dob', 'redact:diagnosis']
  }
}
```

#### 2.4 Call Recording Consent

**Legal Requirement:** Inform callers that the call is recorded.

**Implementation:**
```typescript
// In persona firstMessage:
const persona = {
  firstMessage: "Hi, this is [Clinic Name]'s AI scheduling assistant. This call is recorded for quality and training purposes. How can I help you today?"
}
```

---

### 3. Administrative Safeguards

#### 3.1 Workforce Training

All staff with dashboard access must complete:
- HIPAA training (annual)
- Security awareness training
- Incident response training

#### 3.2 Policies & Procedures

Document the following:
- [ ] PHI access policy
- [ ] Incident response plan
- [ ] Breach notification procedures
- [ ] Data retention policy (calls, transcripts)
- [ ] Disposal procedures (secure deletion after retention period)

#### 3.3 Data Retention & Disposal

**Retention Requirements:**
- Call recordings: 6-7 years (state-dependent)
- Transcripts: 6-7 years
- Appointment logs: 6-7 years

**Secure Disposal:**
```bash
# After retention period expires, securely delete:
# 1. Delete from Supabase
DELETE FROM voice_agent_calls WHERE created_at < NOW() - INTERVAL '7 years';

# 2. Delete from Supabase Storage (recordings)
supabase storage rm <bucket> <file-path>

# 3. Audit log the deletion
INSERT INTO audit_log (action, user_id, reason) VALUES ('phi_deleted', 'system', 'retention_expiry');
```

---

### 4. Physical Safeguards

- ⚠️ Restrict physical access to servers (if self-hosting)
- ⚠️ Encrypt hard drives on developer machines
- ⚠️ Secure disposal of hardware containing PHI

---

### 5. Breach Notification

If PHI is exposed (e.g., unauthorized access, accidental public S3 bucket):

**Timeline:**
- **60 days** to notify affected patients
- **60 days** to notify HHS (if >500 people affected)
- **Immediately** notify business associates (vendors)

**Incident Response:**
1. Contain breach (lock down access, revoke keys)
2. Assess scope (how many records? what PHI?)
3. Notify legal counsel
4. Notify affected patients via mail
5. File breach report with HHS via [Breach Portal](https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf)

---

### 6. Supabase-Specific HIPAA Configuration

To make Supabase HIPAA-compliant:

**1. Upgrade to Pro Plan or higher**
```bash
# Required features:
# - Point-in-time recovery (PITR)
# - Daily backups
# - Advanced security (row-level security)
```

**2. Enable Row-Level Security (RLS)**
```sql
-- Force RLS on all tables with PHI
ALTER TABLE voice_agent_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_agent_contacts ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can access their org's data
CREATE POLICY org_isolation ON voice_agent_calls
  USING (organization_id = auth.jwt() ->> 'organization_id');
```

**3. Audit Logging**
```sql
-- Log all PHI access
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  table_name text,
  record_id uuid,
  ip_address inet,
  created_at timestamptz DEFAULT now()
);

-- Trigger on PHI tables
CREATE TRIGGER audit_call_access
  AFTER SELECT, UPDATE, DELETE ON voice_agent_calls
  FOR EACH ROW EXECUTE FUNCTION log_access();
```

---

### 7. Vapi-Specific HIPAA Configuration

**Contact Vapi.ai for:**
- BAA (Business Associate Agreement)
- HIPAA-eligible instance (may require Enterprise plan)

**Configure secure call handling:**
```typescript
const assistant = await vapiClient.post('/assistant', {
  name: 'HIPAA-Compliant Medical Scheduler',
  transcriber: {
    provider: 'deepgram',
    model: 'nova-2-medical', // Deepgram medical model
    keywords: [] // No custom keywords - avoid leaking PHI in config
  },
  model: {
    provider: 'openai',
    model: 'gpt-4o', // Must have BAA with OpenAI
    messages: [
      {
        role: 'system',
        content: 'You are a HIPAA-compliant medical scheduler. Do not ask for or store detailed medical information. Only collect: patient first name, callback number, and appointment preference.'
      }
    ]
  },
  recordingEnabled: true, // Required for compliance auditing
  endCallFunctionEnabled: true
})
```

---

### 8. Compliance Checklist

Before going live with healthcare use case:

- [ ] BAAs signed with all vendors
- [ ] Supabase upgraded to Pro + RLS enabled
- [ ] Encryption at rest and in transit verified
- [ ] MFA enabled for all admin users
- [ ] Audit logging implemented and tested
- [ ] Data retention policy documented
- [ ] Breach response plan documented
- [ ] Call recording consent message added to persona
- [ ] Staff HIPAA training completed
- [ ] Penetration testing performed
- [ ] Privacy policy updated to include HIPAA language
- [ ] Security risk assessment documented

---

### 9. Cost Impact

HIPAA compliance adds costs:

| Service | Non-HIPAA | HIPAA | Difference |
|---------|-----------|-------|------------|
| Supabase | $25/mo (Pro) | $599/mo (Enterprise) | +$574/mo |
| OpenAI | $0.03/1K tokens | Enterprise pricing | Contact sales |
| Deepgram | $0.0043/min | Medical model | +20% |
| Vapi.ai | $0.05/min | Enterprise + BAA | Contact sales |
| Twilio | $0.0075/SMS | HIPAA eligible | Same |

**Estimated total:** +$800-$1,500/month for HIPAA compliance

---

### 10. Alternatives to Full HIPAA Compliance

If full HIPAA compliance is cost-prohibitive:

**Option 1: Limited PHI Collection**
- Only collect: first name, phone number, appointment preference
- Don't collect: birthdate, SSN, diagnosis, insurance info
- This may reduce HIPAA scope (consult legal counsel)

**Option 2: Human Handoff Before PHI**
- AI handles initial greeting and appointment type selection
- Transfer to human before collecting any PHI
- Human completes booking in HIPAA-compliant system

**Option 3: Self-Hosted Alternative**
- Replace Vapi with self-hosted Asterisk + LLM
- Replace Supabase with self-hosted PostgreSQL on HIPAA-compliant hosting
- Higher upfront cost, lower ongoing costs

---

## Resources

- [HHS HIPAA for Professionals](https://www.hhs.gov/hipaa/for-professionals/index.html)
- [Supabase HIPAA Guide](https://supabase.com/docs/guides/platform/hipaa)
- [Twilio HIPAA Compliance](https://www.twilio.com/en-us/hipaa)
- [Deepgram Healthcare Compliance](https://deepgram.com/solutions/healthcare)
- [OpenAI Enterprise Privacy](https://openai.com/enterprise-privacy)

---

**Disclaimer:** This document provides general guidance and is not legal advice. Consult a healthcare attorney and compliance specialist before deploying this system for healthcare use cases.
