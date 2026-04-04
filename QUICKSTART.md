# Voice AI Agent - Quick Start Guide

## 5-Step Setup

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd voice-ai-agent
npm install
```

### 2. Configure Environment Variables
```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys:
- **Vapi.ai**: Get API key from https://vapi.ai/dashboard
- **Twilio**: Get credentials from https://console.twilio.com
- **Cal.com**: Generate API key at https://cal.com/settings/developer
- **Supabase**: Create project at https://supabase.com

### 3. Set Up Supabase Database
```bash
# Apply migrations to your Supabase project
cd supabase/migrations
# Copy SQL files and run in Supabase SQL Editor
# Or use Supabase CLI:
npx supabase db push
```

Tables created:
- `voice_agent_calls` - Call logs
- `voice_agent_contacts` - CRM contacts
- `bookings` - Cal.com bookings
- `sms_logs` - SMS history
- `transcripts` - Call transcripts
- `personas` - Agent configurations
- `dnc_list` - Do Not Call list
- `voice_agent_campaigns` - Outbound campaigns

### 4. Deploy to Vercel
```bash
npx vercel --prod
```

Set environment variables in Vercel dashboard.

### 5. Configure Webhooks

**Vapi Webhook:**
1. Go to Vapi.ai Dashboard → Settings → Webhooks
2. Add webhook URL: `https://your-app.vercel.app/api/webhooks/vapi`
3. Copy webhook secret to `VAPI_WEBHOOK_SECRET` in .env

**Twilio Webhook:**
1. Go to Twilio Console → Phone Numbers → Your Number
2. Set SMS webhook URL: `https://your-app.vercel.app/api/webhooks/twilio`
3. Method: POST

## Test Your Setup

### Test Health Endpoint
```bash
curl https://your-app.vercel.app/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "vapi": { "status": "ok" },
    "supabase": { "status": "ok" },
    "twilio": { "status": "ok" },
    "calcom": { "status": "ok" }
  }
}
```

### Create Your First Agent
1. Visit `https://your-app.vercel.app/dashboard/personas`
2. Click "New Persona"
3. Fill in:
   - **Name**: "Sales Assistant"
   - **Voice**: Select from ElevenLabs voices
   - **System Prompt**: "You are a helpful sales assistant..."
   - **First Message**: "Hello! How can I help you today?"
4. Click "Create Persona"

### Make a Test Call
Use the Vapi dashboard or API to initiate a test call with your new assistant.

## Success Criteria ✅

You're all set when:
- [ ] Health endpoint returns all green
- [ ] First persona created
- [ ] Test call completed successfully
- [ ] Call appears in dashboard
- [ ] Booking created via Cal.com
- [ ] SMS confirmation sent
- [ ] Transcript saved to Supabase

## Common Issues

### "Vapi webhook signature invalid"
- Verify `VAPI_WEBHOOK_SECRET` matches webhook secret in Vapi dashboard

### "Supabase connection failed"
- Check `SUPABASE_SERVICE_ROLE_KEY` is correct
- Verify RLS policies allow service role access

### "Cal.com API error"
- Ensure `CALCOM_API_KEY` has event type access
- Test API key: `curl -H "Authorization: Bearer $CALCOM_API_KEY" https://api.cal.com/v1/event-types`

### "Twilio SMS failed"
- Verify phone number is verified in Twilio
- Check `TWILIO_PHONE_NUMBER` is in E.164 format (+1234567890)

## Next Steps

- **Dashboard**: https://your-app.vercel.app/dashboard
- **Active Calls**: https://your-app.vercel.app/dashboard/enhanced
- **Personas**: https://your-app.vercel.app/dashboard/personas
- **API Docs**: See DEPLOYMENT.md for full API reference

## Support

Issues? Check:
1. Health endpoint status
2. Vercel deployment logs
3. Supabase logs
4. Vapi webhook logs

For Vapi-specific issues: https://docs.vapi.ai
For Twilio issues: https://www.twilio.com/docs
