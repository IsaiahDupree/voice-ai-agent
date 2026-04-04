# Demo Script

**F1399**: Script for live demo of the Voice AI Agent system

**Duration:** 15-20 minutes

---

## Pre-Demo Setup (5 min before)

### 1. Environment Check
- [ ] Dashboard loaded: `https://your-domain.vercel.app/dashboard`
- [ ] Test assistant created and active
- [ ] Test contact added to CRM
- [ ] Cal.com calendar has available slots today
- [ ] Twilio SMS configured
- [ ] Your phone ready to receive test call

### 2. Browser Tabs Open
1. Dashboard (main view)
2. Vapi dashboard (for logs)
3. Cal.com dashboard (to show booking appear)
4. Supabase (to show data in real-time)

### 3. Test Call
Run one quick test call to ensure everything works.

---

## Demo Flow

### Introduction (2 min)

**You:**
> "Thanks for joining! Today I'll show you our Voice AI Agent system - a complete solution for automating phone calls, booking appointments, and managing customer interactions. By the end of this demo, you'll see a live AI agent make a call, handle a conversation, book an appointment, and send a follow-up SMS."

**Show:** Dashboard home screen

> "This is the main dashboard. Here you can see call activity, bookings, and key metrics at a glance."

---

### Part 1: Create an Assistant (3 min)

**You:**
> "First, let's create an AI assistant. Think of this as hiring a virtual receptionist or sales rep."

**Navigate to:** Dashboard → Personas (or Assistants)

**Click:** "Create New Persona"

**Fill in:**
- Name: "Sarah - Sales Assistant"
- Voice: Select ElevenLabs voice (play sample)
- First Message: "Hi! This is Sarah calling from Acme Corp. How are you today?"
- Personality: "Friendly, professional, goal-oriented"

**Show:** System prompt

> "This is where we define Sarah's personality, talking points, and how she should handle objections. For this demo, I've set her up to qualify leads and book discovery calls."

**Show:** Function tools

> "Sarah has access to these tools:
> - Check calendar availability
> - Book appointments
> - Send SMS
> - Transfer to a human if needed
> - Add callers to Do Not Call list"

**Click:** Save

**You:**
> "Sarah is now ready to make calls. In a real deployment, you'd test and refine the script over a few iterations, but for demo purposes, this works great out of the box."

---

### Part 2: Live Outbound Call (5 min)

**You:**
> "Now let's watch Sarah make a live call. I'm going to have her call my phone, and I'll answer and act as a prospect."

**Navigate to:** Dashboard → Campaigns → Manual Dial

**Enter:**
- Phone number: (your number)
- Assistant: Sarah
- Contact name: "Demo Prospect"

**Click:** "Start Call"

**You:**
> "The call is now being placed..."

*Phone rings*

**Answer call, put on speaker:**

**AI (Sarah):**
> "Hi! This is Sarah calling from Acme Corp. How are you today?"

**You (as prospect):**
> "I'm good, what's this about?"

**AI:**
> "Great! I'm reaching out because we help businesses like yours [value prop]. Do you have a quick minute to chat?"

**You:**
> "Sure, I guess. What do you offer?"

**AI:**
> [Explains value proposition]

**You:**
> "Interesting. Can I schedule a time to learn more?"

**AI:**
> "Absolutely! Let me check my calendar. Are you available this Thursday at 2pm?"

**You:**
> "Yes, that works."

**AI:**
> "Perfect! I'll need your email to send you a confirmation..."

**You:**
> "It's demo@example.com"

**AI:**
> "Great! I've booked Thursday, April 3rd at 2pm for you. You'll receive a confirmation email and text shortly. Looking forward to it!"

**You:**
> "Thanks!"

**End call**

**You (to audience):**
> "Notice how Sarah:
> - Sounded natural and human-like
> - Handled the conversation flow smoothly
> - Checked calendar availability in real-time
> - Collected the information needed
> - Confirmed the booking
>
> All of that happened automatically - no human involvement."

---

### Part 3: Show the Data (4 min)

**Navigate to:** Dashboard → Calls

**You:**
> "Here's the call that just happened. You can see:
> - Call duration
> - Outcome (booked)
> - Sentiment (positive)
> - Cost ($0.32)"

**Click:** Call to open details

**Show:** Full transcript

**You:**
> "Here's the complete transcript. Notice the word-level timestamps, sentiment analysis on each exchange, and highlighted keywords. The system automatically detected this was a 'booking' intent."

**Scroll to:** Metadata section

**Show:**
- Action items: "Send confirmation email", "Follow up day before"
- Keywords: "interested", "Thursday", "2pm", "demo"
- Quality score: 92/100
- Talk ratio: Agent 45%, User 55% (good balance)

**Navigate to:** Dashboard → Bookings

**You:**
> "And here's the appointment that was just created."

**Open new tab:** Cal.com dashboard

**You:**
> "If I check Cal.com, you'll see the booking appeared there as well. The contact will receive a confirmation email from Cal.com automatically."

**Show:** Email/SMS (if accessible)

**You:**
> "The contact also received this SMS confirmation from our system via Twilio."

---

### Part 4: CRM & Contact Management (2 min)

**Navigate to:** Dashboard → Contacts

**You:**
> "Every call automatically creates or updates a contact record. Let me show you the contact we just created."

**Click:** Demo Prospect contact

**Show:**
- Contact details (name, phone, email)
- Call history (1 call, 3 minutes, booked)
- Tags: "lead", "interested"
- Deal stage: "qualified"
- Timeline of interactions

**You:**
> "This lightweight CRM keeps everything organized. You can see all interactions, notes, and upcoming appointments for each contact."

---

### Part 5: Analytics & Insights (2 min)

**Navigate to:** Dashboard → Analytics

**You:**
> "The analytics dashboard gives you a bird's-eye view of performance."

**Show:**
- Total calls today: 1
- Bookings: 1
- Conversion rate: 100% (laugh)
- Average call duration: 3 min
- Sentiment distribution: 1 positive

**You:**
> "In a real deployment with hundreds of calls, you'd see trends over time:
> - Which scripts convert best
> - Optimal calling times
> - Common objections
> - Cost per booking
>
> This data helps you continuously optimize performance."

---

### Part 6: Scaling & Use Cases (2 min)

**You:**
> "Now imagine scaling this:
> - Instead of 1 call, you're making 200 per day
> - Instead of me acting as the prospect, these are real leads
> - Instead of booking demo calls, you could be:
>   - Scheduling appointments for a clinic
>   - Qualifying leads for B2B sales
>   - Following up on inbound inquiries
>   - Handling customer support
>   - Event registration
>
> The AI works 24/7, never gets tired, and costs about $0.30 per call - far less than a human agent."

**Show:** Cost calculation

> "For context:
> - 200 calls/day = 6,000 calls/month
> - At $0.30/call = $1,800/month
> - 20% booking rate = 1,200 appointments
> - Cost per booked appointment = $1.50
>
> Compare that to hiring an SDR at $4,000/month who might book 100 appointments. The ROI is clear."

---

### Q&A (remaining time)

**Common questions:**

**Q: "Does it sound robotic?"**
A: "You just heard it - it sounds human. ElevenLabs voices are incredibly natural."

**Q: "What if the AI doesn't understand something?"**
A: "It can transfer to a human agent with full context of the conversation so far."

**Q: "Can it handle different languages?"**
A: "Yes - the system auto-detects language and can converse in English, Spanish, French, German, and more."

**Q: "How long does setup take?"**
A: "For a basic deployment, about 30-60 minutes if you have API keys ready. Full client onboarding with custom scripts takes 2-4 weeks."

**Q: "What's the booking rate in real deployments?"**
A: "It varies by use case:
- Warm leads (opt-in list): 20-30%
- Cold B2B: 5-15%
- Inbound inquiries: 40-60%"

---

## Closing (1 min)

**You:**
> "That's the Voice AI Agent system! To recap:
> - ✅ Natural-sounding AI voice
> - ✅ Real-time calendar integration
> - ✅ Automatic CRM updates
> - ✅ Full transcripts and analytics
> - ✅ SMS follow-ups
> - ✅ Scales to thousands of calls
> - ✅ Costs $0.30/call
>
> Questions?"

---

## Post-Demo Follow-Up

**Send within 1 hour:**

Email template:

> Subject: Voice AI Agent Demo - Next Steps
>
> Hi [Name],
>
> Thanks for joining the demo! As promised, here are the resources:
>
> - Demo recording: [link]
> - Documentation: [GitHub repo]
> - Pricing calculator: [link]
> - Sample transcripts: [link]
>
> Next steps:
> 1. Review the docs
> 2. Schedule a strategy call to discuss your specific use case
> 3. We'll build a custom assistant and run a 1-week pilot
>
> Calendar link: [Cal.com link]
>
> Let me know if you have any questions!
>
> Best,
> [Your name]

---

## Demo Troubleshooting

### Issue: Call doesn't connect

**Cause:** Vapi API issue or wrong number format

**Fix:**
- Check Vapi dashboard for errors
- Verify number is E.164 format (+1234567890)
- Use backup demo video if live call fails

### Issue: Booking fails

**Cause:** Cal.com event type misconfigured

**Fix:**
- Quickly check Cal.com availability
- Use alternative time slot
- Fallback: show pre-recorded demo of successful booking

### Issue: Dashboard is slow

**Cause:** Cold start (Vercel serverless)

**Fix:**
- Pre-load dashboard 2 minutes before demo
- Keep tab open and refreshed

---

## Demo Variants

### 10-Minute Version (Executive Summary)
- Skip assistant creation (use pre-made)
- Show live call only
- Quick walkthrough of transcript + booking
- Analytics overview

### 30-Minute Version (Technical Deep Dive)
- Include API demonstration
- Show database schema
- Explain architecture
- Code walkthrough
- Custom tool creation

### 5-Minute Version (Elevator Pitch)
- Pre-recorded call (30 sec clip)
- Show transcript + booking result
- Analytics summary
- One-sentence ROI statement
