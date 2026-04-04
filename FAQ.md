# Frequently Asked Questions

**F1396**: Common questions about the Voice AI Agent system

---

## Setup & Installation

### Q: What do I need to get started?

**A:** You need:
1. Vapi.ai account + API key
2. Cal.com account (for booking)
3. Twilio account (for SMS)
4. Supabase project
5. OpenAI API key (for GPT-4o)
6. ElevenLabs account (for premium voices)
7. Deepgram account (for transcription)

### Q: How long does setup take?

**A:** Initial setup takes 30-60 minutes if you have all accounts ready. Most time is spent configuring API keys and webhook endpoints.

### Q: Can I test without a phone number?

**A:** Yes! Use Vapi's web widget for browser-based testing before purchasing phone numbers.

---

## Calls & Assistants

### Q: How many concurrent calls can the system handle?

**A:** Limited by your Vapi.ai plan. Free tier supports ~5 concurrent, paid tiers scale to hundreds.

### Q: Can I transfer calls to a human?

**A:** Yes! Use the `transferCall` function tool during a call. Configure transfer numbers in your assistant settings.

### Q: What languages are supported?

**A:** The system detects English, Spanish, French, and German automatically. Deepgram and ElevenLabs support 20+ languages.

### Q: How accurate is the transcription?

**A:** Deepgram achieves 90-95% accuracy for clear audio. Quality depends on:
- Background noise
- Speaker clarity
- Audio bitrate
- Accent strength

---

## Booking & Calendar

### Q: Which calendar systems are supported?

**A:** Cal.com is the primary integration. Cal.com syncs with Google Calendar, Outlook, and Apple Calendar.

### Q: Can I book multiple event types?

**A:** Yes! Pass `eventTypeId` to the `bookAppointment` tool. Create multiple event types in Cal.com.

### Q: What happens if a time slot is unavailable?

**A:** The assistant will:
1. Check availability in real-time
2. Suggest alternative slots if requested time is taken
3. Book the first available match

### Q: Can I cancel or reschedule bookings via call?

**A:** Yes! Use the `cancelBooking` tool. Rescheduling requires canceling + rebooking.

---

## Transcripts & Analytics

### Q: How long are transcripts stored?

**A:** Indefinitely in Supabase. You can set retention policies in your database.

### Q: Can I export transcripts?

**A:** Yes! Formats supported:
- Plain text (.txt)
- JSON (structured data)
- SRT subtitles

### Q: What analytics are tracked?

**A:** The system tracks:
- Total calls (inbound/outbound)
- Call duration
- Bookings created
- Conversion rates
- Sentiment scores
- Most common keywords
- Talk time ratios

### Q: Can I integrate with external analytics tools?

**A:** Yes! Export data via API or set up webhooks to push events to Segment, Mixpanel, etc.

---

## CRM & Contacts

### Q: Does the system include a CRM?

**A:** Yes, a lightweight CRM is built-in. It tracks:
- Contact details (name, email, phone)
- Call history
- Booking history
- Tags & deal stages
- Notes

### Q: Can I import existing contacts?

**A:** Yes! Use `POST /api/contacts/bulk` or import CSV via the dashboard.

### Q: How are duplicate contacts handled?

**A:** The system detects duplicates by phone number. You can manually merge duplicates via the dashboard.

---

## SMS

### Q: Can the AI send follow-up SMS?

**A:** Yes! The `sendSMS` function tool can be called during calls. You can also schedule SMS via campaigns.

### Q: Do SMS conversations show in the dashboard?

**A:** Yes! Two-way SMS threads are grouped by contact in the Inbox tab.

### Q: What's the SMS character limit?

**A:** Standard SMS: 160 characters. Messages beyond 160 are split into multiple segments.

---

## Pricing & Costs

### Q: How much does it cost per call?

**A:** Typical costs (outbound, 3-minute call):
- Vapi.ai: ~$0.05/min = $0.15
- Deepgram transcription: ~$0.0043/min = $0.013
- ElevenLabs TTS: ~$0.30/1K chars ≈ $0.15
- Twilio (optional SMS): $0.0079
- **Total: ~$0.32 per call**

Inbound calls may have lower costs (no ElevenLabs outbound TTS).

### Q: Is there a monthly minimum?

**A:** Depends on providers:
- Vapi.ai: Free tier available
- Twilio: Pay-as-you-go (no minimum)
- Cal.com: Free for basic features

### Q: Can I use free models to reduce costs?

**A:** Partially:
- Switch GPT-4o → GPT-4o-mini (5x cheaper)
- Use Deepgram Nova-2 (already cost-effective)
- Hosting on Vercel is free (hobby tier)

---

## Compliance & Privacy

### Q: Is the system HIPAA compliant?

**A:** Not by default. For HIPAA compliance:
1. Use Vapi's HIPAA-compliant tier
2. Enable Supabase encryption at rest
3. Add BAA agreements with all vendors
4. See `HIPAA-COMPLIANCE.md` for full checklist

### Q: Where is call data stored?

**A:** - Transcripts: Supabase (your database)
- Recordings: Vapi.ai or Twilio (configurable)
- Analytics: Supabase

### Q: Can I delete all data for a contact?

**A:** Yes! Use `DELETE /api/contacts/:id?purge=true` to remove all associated calls, transcripts, and bookings.

---

## Troubleshooting

### Q: Calls aren't connecting. What should I check?

**A:** 1. Verify Vapi API key is correct
2. Check phone number format (E.164: +1234567890)
3. Ensure assistant ID exists
4. Check Vapi dashboard for error logs

### Q: Transcripts are empty or incomplete.

**A:** - Check Deepgram API key
- Verify webhook URL is publicly accessible
- Check call duration (very short calls may not transcribe)

### Q: Bookings fail with "slot unavailable" error.

**A:** - Verify Cal.com event type ID
- Check calendar availability in Cal.com dashboard
- Ensure timezone is correct

### Q: SMS not sending.

**A:** - Verify Twilio account is active
- Check phone number is SMS-capable
- Ensure messaging service SID is configured
- Check recipient isn't on DNC list

### Q: Assistant isn't calling function tools.

**A:** - Ensure tools are defined in assistant config
- Check tool parameters match schema
- Review function tool logs: `GET /api/tools/history`

---

## Customization

### Q: Can I change the AI voice?

**A:** Yes! ElevenLabs offers 50+ voices. Configure in assistant settings:
```json
{
  "voice": {
    "provider": "11labs",
    "voiceId": "21m00Tcm4TlvDq8ikWAM" // Rachel
  }
}
```

### Q: How do I customize the AI's personality?

**A:** Edit the system message in your assistant's model config. See `PERSONA-GUIDE.md` for examples.

### Q: Can I add custom function tools?

**A:** Yes! Define tools in `lib/function-tools.ts` and implement handlers in `app/api/tools/`.

---

## Deployment & Scaling

### Q: Where should I deploy this?

**A:** Recommended: Vercel (seamless Next.js deployment). Alternatives: Railway, Render, AWS.

### Q: How do I enable HTTPS for webhooks?

**A:** Vercel provides HTTPS by default. For custom domains, add SSL cert via Vercel dashboard.

### Q: Can I run multiple instances?

**A:** Yes! Each instance can have separate Vapi accounts or share one (configure via env vars).

### Q: What's the maximum calls per day?

**A:** Limited by:
1. Vapi.ai plan (e.g., 10K minutes/month)
2. Database connection limits
3. Your Twilio limits

---

## Support

### Q: Where do I get help?

**A:** 1. Check this FAQ
2. Read docs: `QUICKSTART.md`, `TROUBLESHOOTING.md`
3. GitHub Issues: [repo link]
4. Vapi.ai Discord community

### Q: How do I report a bug?

**A:** Open a GitHub issue with:
- Steps to reproduce
- Expected vs actual behavior
- Logs from Vercel or browser console

### Q: Can I request new features?

**A:** Yes! Open a GitHub issue with the "feature request" label.

---

## Advanced

### Q: Can I use this for cold calling?

**A:** Yes, but:
1. Ensure compliance with TCPA (USA) or equivalent laws
2. Maintain a Do Not Call list
3. Use the `optOutDNC` tool to honor opt-out requests
4. See `TCPA-COMPLIANCE.md`

### Q: Can I integrate with Zapier/Make?

**A:** Yes! Use webhooks to trigger Zaps on events (call.ended, booking.created, etc.)

### Q: How do I A/B test different scripts?

**A:** Create multiple assistants with different prompts. Use campaign routing to split traffic 50/50.

### Q: Can the AI detect urgency or priority?

**A:** Yes! Intent classification tags calls as "urgent", "inquiry", "complaint", etc. Use this to route high-priority calls to humans.
