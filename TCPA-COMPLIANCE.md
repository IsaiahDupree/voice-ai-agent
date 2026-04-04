# TCPA Compliance Guide

## What is TCPA?

The **Telephone Consumer Protection Act (TCPA)** is a US federal law that restricts telemarketing calls, auto-dialed calls, prerecorded messages, text messages, and fax messages.

**Penalties for violations:**
- $500 per violation
- Up to $1,500 per willful violation
- Class-action lawsuits possible

## TCPA Requirements for Voice AI Agents

### 1. Prior Express Written Consent

**Requirement:** You must have written consent before making automated calls.

**What qualifies as consent:**
- ✅ Signed agreement (digital or physical)
- ✅ Online form with explicit opt-in checkbox
- ✅ SMS opt-in with confirmation
- ✅ Existing business relationship (EBR) for some contexts

**What does NOT qualify:**
- ❌ Pre-checked checkboxes
- ❌ Consent buried in terms of service
- ❌ Purchased lead lists without verification
- ❌ Inferring consent from website visit

**Example opt-in language:**
```
[ ] Yes, I consent to receive automated calls and text messages from [COMPANY NAME] at the phone number provided. I understand that consent is not a condition of purchase. Message and data rates may apply.
```

### 2. Clear Identification

**Requirement:** Agent must identify itself and the company at the start of every call.

**Compliant opening:**
```
"Hi, this is [AGENT NAME] from [COMPANY NAME]. [PURPOSE OF CALL]."
```

**Example:**
```
"Hi, this is Sarah from CloudSync. I'm calling to see if you'd be interested in learning about our cloud cost optimization services."
```

**Non-compliant:**
```
"Hey, how are you doing today?"
// ❌ Doesn't identify agent or company
```

### 3. Opt-Out Mechanism

**Requirement:** Provide a clear way for recipients to opt out of future calls.

**Verbal opt-out:**
- Agent must honor "stop calling me", "remove me from your list", "don't call again"
- Agent should confirm: "I've removed you from our list. You won't hear from us again."

**Implement in system prompt:**
```
If the caller says any of these phrases:
- "Stop calling me"
- "Remove me from your list"
- "Don't call again"
- "Put me on your do not call list"
- "I'm not interested, don't call back"

You MUST:
1. Immediately stop the sales pitch
2. Say: "I understand. I'll make sure we remove you from our list. Have a great day."
3. Mark the contact as DNC (Do Not Call) in the system
4. End the call politely
```

**Automated opt-out tracking:**
```javascript
// In persona system prompt
if (callerRequestsOptOut()) {
  updateContact({ dnc: true, dnc_reason: 'caller_request', dnc_date: new Date() });
  endCall();
}
```

### 4. Do Not Call (DNC) Registry

**Requirement:** Scrub your contact lists against the National DNC Registry.

**How to comply:**
1. **Access DNC Registry**: https://www.donotcall.gov/register/reg.aspx
2. **Download list** (requires registration, $67 per area code)
3. **Scrub contacts** before starting campaign:
   ```bash
   curl -X POST https://your-app.vercel.app/api/contacts/scrub-dnc \
     -F "file=@contacts.csv" \
     -F "dnc_list=@dnc_registry.csv"
   ```

**Internal DNC list:**
```sql
CREATE TABLE dnc_list (
  phone_number VARCHAR(20) PRIMARY KEY,
  added_date TIMESTAMP DEFAULT NOW(),
  source VARCHAR(50) -- 'national_registry', 'caller_request', 'manual'
);

-- Check before calling
SELECT * FROM dnc_list WHERE phone_number = '+15551234567';
```

**Exceptions:**
- Existing business relationship (EBR): Can call for 18 months after last purchase
- Inquiry/application: Can call for 3 months after inquiry

### 5. Calling Time Restrictions

**Requirement:** No calls before 8 AM or after 9 PM in the recipient's local time.

**Implementation:**
```javascript
// lib/campaign-compliance.ts
const callingHoursAllowed = (timezone) => {
  const now = new Date();
  const localTime = toTimeZone(now, timezone);
  const hour = localTime.getHours();

  // TCPA hours: 8 AM - 9 PM
  if (hour < 8 || hour >= 21) {
    return false;
  }

  return true;
};
```

**Configure in campaign:**
```json
{
  "calling_hours_start": "08:00",
  "calling_hours_end": "21:00",
  "timezone": "America/New_York",
  "respect_tcpa_hours": true
}
```

### 6. Call Frequency Limits

**Requirement:** Reasonable call attempts (not defined by TCPA, but best practice).

**Best practices:**
- Max 3 attempts per contact
- 24-hour gap between attempts
- Don't call same number multiple times in one day

**Implementation:**
```javascript
// Check attempt count before calling
const contact = await getContact(phoneNumber);
if (contact.attempt_count >= 3) {
  console.log('Max attempts reached, skipping contact');
  return;
}

// Log attempt
await incrementAttemptCount(contact.id);
```

### 7. Abandoned Call Rate

**Requirement:** For predictive dialers, abandoned call rate must be < 3%.

**What is an abandoned call:**
- Call connects but no agent/message within 2 seconds
- Caller hears silence or long delay

**How to comply:**
- Voice AI agents don't have this issue (instant greeting)
- Ensure first message plays immediately on connect

### 8. Recordkeeping

**Requirement:** Keep records of consent, opt-outs, and call logs.

**Retention periods:**
- Consent records: 4 years
- Opt-out requests: 5 years
- Call logs: 4 years

**What to log:**
```sql
-- Call logs
CREATE TABLE voice_agent_calls (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20),
  consent_id UUID REFERENCES consents(id), -- Link to consent record
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  recording_url VARCHAR(500),
  transcript TEXT,
  outcome VARCHAR(50),
  dnc_requested BOOLEAN
);

-- Consent records
CREATE TABLE consents (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20),
  consent_text TEXT,
  consented_at TIMESTAMP,
  ip_address VARCHAR(50),
  user_agent TEXT,
  source VARCHAR(100) -- 'website_form', 'sms_optin', 'signed_agreement'
);

-- Opt-out logs
CREATE TABLE opt_outs (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20),
  opted_out_at TIMESTAMP,
  method VARCHAR(50), -- 'voice_call', 'sms_reply', 'manual'
  call_id UUID REFERENCES voice_agent_calls(id)
);
```

## TCPA Compliance Checklist

### Before Campaign Launch

- [ ] Verify all contacts have documented consent
- [ ] Scrub contact list against National DNC Registry
- [ ] Check internal DNC list for opt-outs
- [ ] Configure calling hours (8 AM - 9 PM recipient time)
- [ ] Set max attempts per contact (recommend 3)
- [ ] Configure opt-out handling in persona system prompt
- [ ] Test opt-out flow (say "remove me" during test call)
- [ ] Enable call recording for compliance logs
- [ ] Verify agent identifies company in first message

### During Campaign

- [ ] Monitor opt-out requests daily
- [ ] Update DNC list immediately upon request
- [ ] Check calling hours compliance (no early/late calls)
- [ ] Review call recordings for compliance issues
- [ ] Log all calls with timestamp, duration, outcome

### After Campaign

- [ ] Archive call logs (retain 4 years)
- [ ] Process any delayed opt-out requests
- [ ] Update consent records if needed
- [ ] Generate compliance report

## Special Cases

### Pre-recorded Messages / Voicemail

**TCPA applies to:**
- Voicemail drops (leaving pre-recorded message)
- Any automated message without live interaction

**Requirements:**
- Must have prior express written consent (higher bar than regular calls)
- Must identify company and provide callback number
- Must provide opt-out mechanism in message

**Compliant voicemail:**
```
"Hi, this is Sarah from CloudSync. I'm calling about cloud cost optimization. If you'd like to learn more, please call me back at 555-1234. To be removed from our list, reply STOP to this text or call 555-1234 and ask to be removed. Thank you."
```

### SMS Follow-ups

**TCPA applies to:**
- Automated text messages sent after calls

**Requirements:**
- Separate consent required for SMS (can't use call consent)
- Must include STOP instructions in every message
- Honor STOP replies immediately

**Compliant SMS:**
```
"Hi John, thanks for speaking with me. Your appointment is confirmed for 2pm on March 28. Reply STOP to opt out."
```

### Transferred Calls

**TCPA applies:**
- If AI agent transfers to human, TCPA still applies to the initial automated call
- Human rep must honor any opt-out requests

**Best practice:**
- Whisper context to human: "Caller consented via [SOURCE] on [DATE]"
- If caller requests opt-out during human call, human must mark DNC

## State-Specific Laws

Some states have stricter laws than TCPA:

### California

- **CCPA applies**: Right to know what data is collected
- **Opt-out language**: Must be clear, not buried

### Florida

- **Statute 501.059**: Additional restrictions on automated calls
- **Stricter DNC**: 5-year consent expiration (vs 18 months federal)

### Texas

- **No Prior Relationship Exception**: Must have consent even with EBR

**Recommendation:** Follow strictest requirements (California/Florida) for all campaigns to ensure compliance across states.

## Penalties and Enforcement

### TCPA Penalties

- $500 per violation (per call)
- $1,500 per willful/knowing violation
- Class-action lawsuits (thousands of plaintiffs)

### Recent TCPA Settlements

- **2023**: Company paid $25M for 50,000 violations
- **2022**: Company paid $15M for auto-dialed calls without consent

### How to Avoid Violations

1. **Document everything**: Consent, opt-outs, call logs
2. **Test your system**: Opt-out flow must work 100% of the time
3. **Train your team**: Everyone handling calls must understand TCPA
4. **Audit regularly**: Monthly review of compliance logs
5. **Update promptly**: Maintain DNC list in real-time

## Compliance Monitoring

### Automated Compliance Checks

```javascript
// Run daily compliance report
async function dailyComplianceReport() {
  // Check for calls outside allowed hours
  const outOfHoursCalls = await db.query(`
    SELECT * FROM voice_agent_calls
    WHERE (EXTRACT(HOUR FROM started_at) < 8 OR EXTRACT(HOUR FROM started_at) >= 21)
    AND created_at > NOW() - INTERVAL '24 hours'
  `);

  // Check for contacts exceeding max attempts
  const excessiveAttempts = await db.query(`
    SELECT phone_number, COUNT(*) as attempts
    FROM voice_agent_calls
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY phone_number
    HAVING COUNT(*) > 3
  `);

  // Check opt-out response time
  const delayedOptOuts = await db.query(`
    SELECT * FROM opt_outs
    WHERE opted_out_at < NOW() - INTERVAL '24 hours'
    AND processed_at IS NULL
  `);

  // Email report
  await sendEmail({
    to: 'compliance@yourcompany.com',
    subject: 'Daily TCPA Compliance Report',
    body: { outOfHoursCalls, excessiveAttempts, delayedOptOuts }
  });
}
```

### Compliance Dashboard

**Key metrics to monitor:**
- Opt-out rate (should be < 5%)
- Average attempts per contact (should be < 2)
- Calls outside allowed hours (should be 0)
- Consent documentation rate (should be 100%)

## Consent Management

### Collecting Consent

**Website form example:**
```html
<form action="/api/consent" method="POST">
  <label>Phone Number</label>
  <input type="tel" name="phone" required />

  <label>
    <input type="checkbox" name="consent" required />
    I consent to receive automated calls and text messages from CloudSync
    at the phone number provided. I understand that consent is not a condition
    of purchase. I can opt out anytime by replying STOP or calling 555-1234.
  </label>

  <button type="submit">Submit</button>
</form>
```

**Backend (log consent):**
```javascript
app.post('/api/consent', async (req, res) => {
  await db.insert('consents', {
    phone_number: req.body.phone,
    consent_text: req.body.consent_text,
    consented_at: new Date(),
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    source: 'website_form'
  });

  res.json({ success: true });
});
```

### Revoking Consent

**When contact requests opt-out:**
```javascript
async function processOptOut(phoneNumber, callId) {
  // Add to DNC list
  await db.insert('dnc_list', {
    phone_number: phoneNumber,
    added_date: new Date(),
    source: 'caller_request'
  });

  // Mark contact
  await db.update('contacts', {
    dnc: true,
    dnc_date: new Date(),
    dnc_reason: 'caller_request'
  }, { phone_number: phoneNumber });

  // Log opt-out
  await db.insert('opt_outs', {
    phone_number: phoneNumber,
    opted_out_at: new Date(),
    method: 'voice_call',
    call_id: callId
  });

  // Pause any active campaigns with this contact
  await db.update('campaign_contacts', {
    status: 'dnc'
  }, { phone_number: phoneNumber });
}
```

## Legal Disclaimer

This guide provides general information about TCPA compliance but does not constitute legal advice. Consult with a qualified attorney to ensure your specific use case complies with TCPA and state laws.

**Recommended:** Work with a telecommunications attorney to:
- Review your consent collection process
- Audit your calling practices
- Draft compliant disclosure language
- Establish compliance procedures

## Resources

- **FCC TCPA Page**: https://www.fcc.gov/general/telemarketing-and-robocalls
- **National DNC Registry**: https://www.donotcall.gov
- **FTC Telemarketing Rules**: https://www.ftc.gov/business-guidance/resources/complying-telemarketing-sales-rule
- **TCPA Attorney Directory**: https://www.tcpaworld.com

## Emergency Response

### If You Receive a TCPA Complaint

1. **Stop calling immediately**: Pause all campaigns
2. **Document**: Pull all call logs, consent records, transcripts
3. **Contact attorney**: Engage TCPA defense counsel
4. **Preserve evidence**: Backup all databases, don't delete anything
5. **Review**: Conduct internal compliance audit

### Proactive Measures

- Monthly compliance training for team
- Quarterly audit of consent and opt-out processes
- Annual legal review of updated TCPA regulations
- Insurance: Consider E&O policy covering TCPA claims
