# Client Onboarding Guide

**F1398**: Steps to onboard a new client to the Voice AI Agent system

---

## Pre-Onboarding Checklist

Before scheduling kickoff call, ensure client has:

- [ ] Business phone number (or willingness to purchase one via Twilio)
- [ ] Calendar system (Google Calendar, Outlook, or willing to use Cal.com)
- [ ] List of common customer questions/objections
- [ ] Brand voice guidelines (tone, language, personality)
- [ ] Decision on call recording consent (varies by state/country)

---

## Onboarding Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Discovery** | Week 1 | Kickoff call, gather requirements, define use cases |
| **Setup** | Week 2 | Configure accounts, build assistant, import contacts |
| **Testing** | Week 3 | Internal testing, refinement, script adjustments |
| **Pilot** | Week 4 | Limited rollout (10-50 calls), monitor closely |
| **Launch** | Week 5+ | Full deployment, ongoing optimization |

---

## Week 1: Discovery

### Kickoff Call Agenda (60 min)

1. **Understand the Business** (15 min)
   - What products/services do you offer?
   - Who is your ideal customer?
   - What's the typical customer journey?

2. **Define Use Cases** (20 min)
   - Inbound lead qualification?
   - Outbound appointment setting?
   - Customer support?
   - Event registration?
   - Combination?

3. **Success Metrics** (10 min)
   - What does success look like?
   - Target booking rate?
   - Acceptable transfer rate?
   - Cost per lead goals?

4. **Technical Requirements** (10 min)
   - Existing CRM integration needed?
   - Calendar preferences?
   - SMS follow-up requirements?

5. **Next Steps** (5 min)
   - Assign action items
   - Schedule Week 2 working session

### Deliverables

- [ ] Completed discovery questionnaire
- [ ] Use case document
- [ ] Success metrics defined
- [ ] Technical requirements doc

---

## Week 2: Setup

### 1. Account Creation

**Client provides:**
- Vapi.ai account (or we create on their behalf)
- Cal.com account credentials
- Twilio account SID + Auth Token
- OpenAI API key (or use agency key)

**You create:**
- Supabase project (or clone template)
- Vercel deployment
- Set environment variables

### 2. Phone Number Acquisition

**Option A: Transfer existing number to Twilio**
- Initiate porting process (7-10 business days)
- Configure temporary number for testing

**Option B: Purchase new Twilio number**
- Search by area code or toll-free
- Verify SMS capability
- Configure webhook URLs

### 3. Assistant Configuration

**Build assistant persona:**

```typescript
{
  name: "Sarah - {{ Client Name }} Assistant",
  voice: {
    provider: "11labs",
    voiceId: "{{ selected voice }}"
  },
  firstMessage: "Hi! This is Sarah calling from {{ Client Name }}. How are you today?",
  model: {
    provider: "openai",
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are Sarah, a friendly assistant for {{ Client Name }}.

Your role: {{ use case description }}

Key points to cover:
- {{ point 1 }}
- {{ point 2 }}
- {{ point 3 }}

Objection handling:
- "I'm not interested" → Acknowledge and ask permission to share one benefit
- "Too expensive" → Focus on ROI and value
- "Call me back later" → Offer to book a specific callback time

Always be:
- Warm and professional
- Concise (avoid rambling)
- Goal-oriented (move toward booking)
- Respectful of their time`
      }
    ]
  },
  tools: [
    "checkCalendar",
    "bookAppointment",
    "sendSMS",
    "transferCall",
    "optOutDNC"
  ]
}
```

### 4. Calendar Integration

**Cal.com setup:**
1. Create event type (e.g., "Discovery Call - 30 min")
2. Set availability (business hours only)
3. Add booking questions (phone, company, notes)
4. Configure confirmation emails
5. Get event type ID → add to assistant config

### 5. Import Contacts

**CSV format:**

```csv
name,phone,email,tags,deal_stage
John Doe,+15551234567,john@example.com,"lead,interested",qualified
Jane Smith,+15559876543,jane@example.com,"lead",new
```

**Import:**

```bash
curl -X POST https://your-domain.vercel.app/api/contacts/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "contacts": [
      { "name": "John Doe", "phone": "+15551234567", "email": "john@example.com" }
    ]
  }'
```

### 6. SMS Templates

**Booking confirmation:**
> Hi {{name}}! This is Sarah from {{company}}. Your appointment is confirmed for {{date}} at {{time}}. See you then! Reply CANCEL to cancel.

**Follow-up (no answer):**
> Hi {{name}}, Sarah from {{company}} tried calling you earlier about {{topic}}. When's a good time to chat? Reply with a time or call us at {{phone}}.

### Deliverables

- [ ] All accounts created and configured
- [ ] Phone number active
- [ ] Assistant persona finalized
- [ ] Calendar connected
- [ ] Contacts imported
- [ ] SMS templates approved

---

## Week 3: Testing

### Internal Test Plan

**Test scenarios:**

1. **Happy path:** Caller answers, interested, books appointment
2. **Objection:** "Not interested" → graceful exit
3. **Transfer:** Caller requests human → successful transfer
4. **Voicemail:** No answer → leaves voicemail
5. **DNC request:** Caller asks to be removed → opt-out confirmed
6. **Technical issue:** Call drops → system handles gracefully

**Test each scenario 3 times to ensure consistency.**

### Test Call Script

**You:** Call test number, act as customer

**AI:** Greets, introduces purpose

**You:** (Scenario 1) Express mild interest

**AI:** Asks qualifying questions

**You:** Answer positively

**AI:** Checks calendar availability

**You:** Confirm preferred time

**AI:** Books appointment, confirms details

**Expected outcome:**
- Booking created in Cal.com ✓
- Transcript captured ✓
- SMS confirmation sent ✓
- Contact created in CRM ✓

### Refinement

**Review transcripts:**
- Is the AI too chatty or too brief?
- Does it handle objections well?
- Are tool calls triggering correctly?

**Adjust system prompt based on findings.**

### Deliverables

- [ ] All test scenarios passed
- [ ] Transcript review completed
- [ ] Script refinements applied
- [ ] Client approval to proceed

---

## Week 4: Pilot Launch

### Limited Rollout

**Start with:**
- 10-50 calls/day
- Warm leads only (existing contacts who opted in)
- Business hours only (9am-5pm)

**Monitor closely:**
- Review every transcript for first 3 days
- Track booking rate
- Note common issues

### Daily Pilot Checklist

**Morning (9am):**
- [ ] Verify system health: `GET /api/health`
- [ ] Check overnight metrics
- [ ] Review any errors in logs

**End of day (6pm):**
- [ ] Review all transcripts from today
- [ ] Calculate booking rate
- [ ] Note any patterns or issues
- [ ] Send client daily summary email

### Pilot Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Calls attempted | 50 | __ |
| Calls answered | 35 (70%) | __ |
| Bookings | 7 (20%) | __ |
| Transfers | 5 (14%) | __ |
| DNC requests | <2 | __ |

### Iteration

**After 3 days, review with client:**
- What's working well?
- What needs adjustment?
- Any unexpected issues?

**Make refinements and continue pilot for full week.**

### Deliverables

- [ ] Pilot completed (minimum 50 calls)
- [ ] Metrics meet or exceed targets
- [ ] Client satisfaction confirmed
- [ ] Final script locked in

---

## Week 5: Full Launch

### Scale Up

**Gradual ramp:**
- Day 1-3: 100 calls/day
- Day 4-7: 200 calls/day
- Week 2+: Full volume

**Expand hours:**
- Add evenings (5pm-8pm) if targeting working professionals
- Add weekends if B2C

### Ongoing Optimization

**Weekly review:**
- Booking rate trends
- Common objections → update script
- Call quality scores → adjust prompts
- Cost per booking → optimize call length

**Monthly review:**
- ROI calculation
- A/B test new scripts
- Expand to new use cases

### Handoff to Client

**Train client team on:**
1. Dashboard navigation
2. Reviewing transcripts
3. Managing contacts
4. Scheduling campaigns
5. Interpreting analytics

**Provide:**
- Video walkthrough (Loom)
- Written documentation
- Support contact

### Deliverables

- [ ] Full launch completed
- [ ] Client team trained
- [ ] Support handoff complete
- [ ] Monthly optimization plan in place

---

## Post-Launch Support

### First Month

**Weekly check-ins:**
- Review metrics
- Address any issues
- Optimize based on data

### Ongoing

**Monthly reporting:**
- Total calls, bookings, conversion rate
- Cost analysis
- Recommendations for improvement

**Quarterly strategy:**
- Expand to new use cases?
- Test new personas?
- Integrate additional tools?

---

## Common Onboarding Pitfalls

### 1. Unrealistic Expectations

**Issue:** Client expects 50%+ booking rate from cold calls

**Solution:** Set realistic targets (15-25% for warm, 5-15% for cold)

### 2. Script Too Long

**Issue:** AI talks for 5+ minutes before getting to the point

**Solution:** Keep intro under 30 seconds, get to value prop fast

### 3. No Objection Handling

**Issue:** AI gives up immediately when caller says "not interested"

**Solution:** Add 1-2 soft objection responses before graceful exit

### 4. Calendar Sync Issues

**Issue:** AI books slots that aren't actually available

**Solution:** Verify Cal.com API connection, test availability checks

### 5. Poor Audio Quality

**Issue:** Caller can't hear AI clearly

**Solution:** Switch to premium ElevenLabs voice, adjust bitrate

---

## Success Story Template

**After successful onboarding, collect testimonial:**

> "Before implementing the Voice AI Agent, we were manually calling 50 leads per day and booking 3-5 appointments. Now, the AI handles 200+ calls daily and consistently books 30-40 appointments per week. Our sales team can focus on closing deals instead of dialing. ROI was positive within the first month."
>
> — {{ Client Name }}, {{ Title }}, {{ Company }}
