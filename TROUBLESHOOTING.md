# Troubleshooting Guide

## Quick Diagnostics

### Health Check
```bash
curl https://your-app.vercel.app/api/health
```

**Healthy response:**
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

**Unhealthy:**
```json
{
  "status": "degraded",
  "services": {
    "vapi": { "status": "up" },
    "supabase": { "status": "up" },
    "twilio": { "status": "down", "error": "Authentication failed" },
    "calcom": { "status": "up" }
  }
}
```

---

## Call Issues

### Calls Not Starting

**Symptom:** Campaign is active but no calls are being placed.

**Diagnosis:**
```bash
# 1. Check campaign status
curl https://your-app.vercel.app/api/campaigns/42

# 2. Check Vapi connectivity
curl https://your-app.vercel.app/api/health | jq '.services.vapi'

# 3. Check calling hours
curl https://your-app.vercel.app/api/campaigns/42 | jq '.calling_hours_start, .calling_hours_end, .timezone'
```

**Solutions:**

| Cause | Solution |
|-------|----------|
| Campaign status is `draft` | Start campaign: POST /api/campaigns/42/actions {action: "start"} |
| Outside calling hours | Wait until calling hours or adjust hours in campaign settings |
| No contacts in queue | Check `campaign_contacts` table for pending contacts |
| Vapi API key invalid | Verify `VAPI_API_KEY` in .env.local |
| Vapi account out of credits | Check Vapi dashboard for balance |

### Calls Dropping Mid-Conversation

**Symptom:** Call connects but drops after 10-30 seconds.

**Common causes:**
1. **Webhook endpoint unreachable**
   - Verify: `curl -X POST https://your-app.vercel.app/api/webhooks/vapi`
   - Should return 200 (even with empty payload)
2. **Database connection timeout**
   - Check Supabase logs for connection errors
   - Verify connection pool settings
3. **LLM API timeout**
   - OpenAI/Anthropic API experiencing issues
   - Check status pages: status.openai.com, status.anthropic.com

**Solutions:**
```bash
# Check recent webhook errors
curl https://your-app.vercel.app/api/webhooks/logs?status=error&limit=10

# Increase Vapi webhook timeout (default 30s)
# In Vapi dashboard: Settings → Webhooks → Timeout → 60s
```

### "Call Failed" in Dashboard

**Symptom:** Call shows status `failed` instead of `completed`.

**Check error logs:**
```bash
curl https://your-app.vercel.app/api/calls/CALL_ID | jq '.error'
```

**Common errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid phone number` | Phone not in E.164 format | Ensure numbers start with + and country code |
| `Number not callable` | Landline or disconnected | Remove from contact list |
| `Rate limit exceeded` | Vapi API rate limit hit | Reduce concurrent calls |
| `Assistant not found` | Persona deleted | Verify persona still exists |

### Poor Call Quality / Robotic Voice

**Symptoms:**
- Voice sounds choppy or laggy
- Long pauses between responses
- Caller complains they can't understand agent

**Solutions:**

**1. Check voice settings:**
```json
{
  "voice_id": "21m00Tcm4TlvDq8ikWAM",
  "voice_settings": {
    "stability": 0.5,
    "similarity_boost": 0.75
  }
}
```

**2. Use ElevenLabs Turbo voices:**
- Turbo voices are optimized for real-time streaming
- Lower latency than standard voices

**3. Reduce LLM response time:**
- Use `gpt-4o` instead of `claude-3-5-sonnet` (faster)
- Simplify system prompt (shorter prompts = faster inference)

**4. Check network:**
```bash
# Ping Vapi servers
ping voice.vapi.ai

# Expected latency: < 100ms
```

### Agent Not Responding to Caller

**Symptom:** Caller speaks but agent doesn't respond or says "I didn't catch that."

**Causes:**
1. **Deepgram STT issue** - Speech not transcribed correctly
2. **Background noise** - Caller environment too noisy
3. **Voice Activity Detection (VAD) too sensitive** - Agent interrupts caller

**Solutions:**

**Adjust VAD threshold:**
```json
{
  "vad": {
    "threshold": 0.5,  // Default
    "prefix_padding_ms": 300,
    "silence_duration_ms": 800
  }
}
```

**Higher threshold (0.7)**: Less sensitive, waits longer before responding
**Lower threshold (0.3)**: More sensitive, responds faster

**Check Deepgram model:**
```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",  // Latest model
    "language": "en"
  }
}
```

---

## Booking Issues

### Calendar Shows No Availability

**Symptom:** Agent says "I don't see any available times" even though calendar has openings.

**Diagnosis:**
```bash
# Test Cal.com API directly
curl -X GET "https://api.cal.com/v1/availability?eventTypeId=YOUR_EVENT_TYPE_ID&startTime=2026-03-28T09:00:00Z&endTime=2026-03-28T17:00:00Z" \
  -H "Authorization: Bearer YOUR_CALCOM_API_KEY"
```

**Solutions:**

| Cause | Solution |
|-------|----------|
| Cal.com API key expired | Regenerate API key in Cal.com dashboard |
| Event type not found | Verify `CAL_COM_EVENT_TYPE_ID` in .env.local |
| Availability cache stale | Clear cache: DELETE /api/cache/availability |
| Timezone mismatch | Ensure caller timezone detected correctly |

### Bookings Created But Not Confirmed

**Symptom:** Booking appears in `bookings` table but not in Cal.com dashboard.

**Check webhook logs:**
```bash
curl https://your-app.vercel.app/api/webhooks/logs?endpoint=/api/webhooks/calcom&limit=10
```

**If no webhook received:**
1. Verify webhook URL in Cal.com: Settings → Webhooks → Add Webhook
   - URL: `https://your-app.vercel.app/api/webhooks/calcom`
   - Events: `booking.created`, `booking.rescheduled`, `booking.cancelled`
2. Test webhook:
   ```bash
   curl -X POST https://your-app.vercel.app/api/webhooks/calcom \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```

### Booking Confirmation SMS Not Sent

**Symptom:** Booking created but no SMS received.

**Diagnosis:**
```bash
# Check SMS logs
curl https://your-app.vercel.app/api/sms/logs?call_id=CALL_ID
```

**Common causes:**

| Cause | Solution |
|-------|----------|
| Twilio API key invalid | Verify `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` |
| Twilio balance $0 | Add credits to Twilio account |
| Contact opted out of SMS | Check `contacts` table for `sms_opted_out=true` |
| Invalid phone number | SMS only works for mobile numbers, not landlines |

---

## Dashboard Issues

### Dashboard Not Loading

**Symptom:** White screen or loading spinner forever.

**Check browser console:**
```
F12 → Console tab
```

**Common errors:**

| Error | Solution |
|-------|----------|
| `Failed to fetch` | API endpoint unreachable, check /api/health |
| `Unauthorized` | API key missing or invalid |
| `CORS error` | Add your domain to CORS whitelist in middleware.ts |

**Verify API connectivity:**
```bash
curl https://your-app.vercel.app/api/campaigns
```

If this fails, backend is down. Check Vercel logs:
```bash
vercel logs --follow
```

### Real-time Updates Not Working

**Symptom:** Dashboard shows stale data, doesn't update when calls complete.

**Cause:** Supabase real-time subscriptions not connected.

**Check Supabase connection:**
```javascript
// In browser console:
window.supabase.getChannels()
// Should show active channels
```

**Solutions:**
1. Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in .env.local
2. Enable real-time in Supabase: Database → Replication → Enable
3. Check RLS policies allow SELECT on tables

### Dashboard Shows Wrong Stats

**Symptom:** Booking count or conversion rate is incorrect.

**Verify data integrity:**
```sql
-- Count bookings manually
SELECT COUNT(*) FROM bookings WHERE created_at > NOW() - INTERVAL '24 hours';

-- Count completed calls
SELECT COUNT(*) FROM voice_agent_calls WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours';

-- Calculate conversion rate
SELECT
  ROUND((COUNT(*) FILTER (WHERE outcome = 'booking_made')::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE status = 'completed'), 0)) * 100, 2) AS conversion_rate
FROM voice_agent_calls
WHERE created_at > NOW() - INTERVAL '24 hours';
```

**If stats don't match:**
- Clear browser cache
- Refresh dashboard data: Click "Refresh" button
- Check for orphaned records (calls without associated contacts)

---

## Function Tool Issues

### `checkCalendar` Tool Not Working

**Symptom:** Agent says "I can't check the calendar right now."

**Test tool directly:**
```bash
curl -X POST https://your-app.vercel.app/api/tools/check-calendar \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2026-03-29",
    "timezone": "America/New_York"
  }'
```

**Expected response:**
```json
{
  "available_slots": [
    {"start": "2026-03-29T09:00:00Z", "end": "2026-03-29T09:30:00Z"},
    {"start": "2026-03-29T14:00:00Z", "end": "2026-03-29T14:30:00Z"}
  ]
}
```

**If error:**
- Check Cal.com API key
- Verify event type ID
- Check Cal.com availability settings (buffer time, working hours)

### `bookAppointment` Tool Fails

**Symptom:** Agent tries to book but returns error to caller.

**Check tool logs:**
```bash
curl https://your-app.vercel.app/api/logs?tool=bookAppointment&status=error&limit=10
```

**Common errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `Time slot not available` | Calendar booked between check and book | Add calendar lock logic |
| `Invalid email address` | Contact email missing or malformed | Make email optional or validate on upload |
| `Missing required field` | Tool params incomplete | Check persona tool configuration |

### `transferCall` Not Working

**Symptom:** Agent says "I'll transfer you" but call drops instead.

**Diagnosis:**
1. Check transfer number is valid: `personas` table → `transfer_number`
2. Test transfer:
   ```bash
   curl -X POST https://your-app.vercel.app/api/tools/transfer-call \
     -d '{"call_id": "CALL_ID", "to_number": "+15551234567"}'
   ```

**Solutions:**
- Verify transfer number is not disconnected
- Check Vapi supports call transfer (some plans don't)
- Ensure transfer number answers (not voicemail)

---

## API Issues

### 429 Rate Limit Exceeded

**Symptom:** API returns `429 Too Many Requests`.

**Rate limits:**
- 100 requests per minute per IP
- 1000 requests per hour per API key

**Solutions:**
1. **Reduce concurrent calls** (fewer API requests)
2. **Implement caching** (cache Cal.com availability for 5 minutes)
3. **Use exponential backoff:**
   ```javascript
   async function retry(fn, retries = 3) {
     for (let i = 0; i < retries; i++) {
       try {
         return await fn();
       } catch (err) {
         if (err.status === 429 && i < retries - 1) {
           await sleep(2 ** i * 1000); // 1s, 2s, 4s
         } else {
           throw err;
         }
       }
     }
   }
   ```

### 500 Internal Server Error

**Symptom:** API returns 500 error.

**Check logs:**
```bash
# Vercel logs
vercel logs --since 1h

# Or via dashboard: Vercel → Project → Logs
```

**Common causes:**
- Database connection pool exhausted
- External API timeout (Vapi, Cal.com, Twilio)
- Unhandled exception in API route

**Debugging:**
```javascript
// Add to API route for detailed error logging
catch (error) {
  console.error('API Error:', error);
  console.error('Stack:', error.stack);
  return Response.json({ error: error.message }, { status: 500 });
}
```

### Webhook Idempotency Issues

**Symptom:** Duplicate bookings or SMS sent twice.

**Check webhook_logs for duplicates:**
```sql
SELECT idempotency_key, COUNT(*)
FROM webhook_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY idempotency_key
HAVING COUNT(*) > 1;
```

**If duplicates found:**
- Webhook idempotency logic is broken
- Check `lib/webhook-handler.ts` for idempotency key extraction
- Verify database transaction rollback on duplicate

---

## Integration Issues

### Vapi Integration

**Issue:** Vapi calls not connecting

**Solutions:**
1. Check API key:
   ```bash
   echo $VAPI_API_KEY
   # Should print key starting with vapi_
   ```
2. Test Vapi API:
   ```bash
   curl https://api.vapi.ai/call \
     -H "Authorization: Bearer $VAPI_API_KEY" \
     -d '{"phoneNumber": "+15551234567", "assistantId": "ASSISTANT_ID"}'
   ```
3. Check Vapi dashboard for account status
4. Verify webhook URL is publicly accessible (no localhost)

### Twilio Integration

**Issue:** SMS not sending

**Solutions:**
1. Check credentials:
   ```bash
   echo $TWILIO_ACCOUNT_SID
   echo $TWILIO_AUTH_TOKEN
   ```
2. Test Twilio API:
   ```bash
   curl -X POST "https://api.twilio.com/2010-04-01/Accounts/$TWILIO_ACCOUNT_SID/Messages.json" \
     --data-urlencode "From=+15551234567" \
     --data-urlencode "To=+15559876543" \
     --data-urlencode "Body=Test" \
     -u "$TWILIO_ACCOUNT_SID:$TWILIO_AUTH_TOKEN"
   ```
3. Check Twilio balance (needs > $0)
4. Verify sending number is Twilio-registered

### Cal.com Integration

**Issue:** Bookings not creating

**Solutions:**
1. Check API key:
   ```bash
   curl https://api.cal.com/v1/me \
     -H "Authorization: Bearer $CAL_COM_API_KEY"
   ```
2. Verify event type exists:
   ```bash
   curl https://api.cal.com/v1/event-types \
     -H "Authorization: Bearer $CAL_COM_API_KEY"
   ```
3. Check webhook is registered:
   - Cal.com dashboard → Settings → Webhooks
   - Should show your webhook URL with status "Active"

### Supabase Integration

**Issue:** Database queries failing

**Solutions:**
1. Check connection string:
   ```bash
   echo $SUPABASE_URL
   echo $SUPABASE_ANON_KEY
   ```
2. Test connection:
   ```bash
   curl "$SUPABASE_URL/rest/v1/campaigns?select=*" \
     -H "apikey: $SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $SUPABASE_ANON_KEY"
   ```
3. Check RLS policies (if getting empty results)
4. Verify connection pool not exhausted (Supabase dashboard → Database → Connection Pooling)

---

## Performance Issues

### Slow API Responses

**Symptom:** API requests taking >2 seconds.

**Diagnosis:**
```bash
# Measure response time
time curl https://your-app.vercel.app/api/campaigns
```

**Common causes:**

| Bottleneck | Solution |
|-----------|----------|
| Slow database query | Add indexes on frequently queried columns |
| External API latency | Cache results (Cal.com availability) |
| Large payloads | Paginate results (limit=50, offset=0) |
| Cold start (serverless) | Use Vercel Pro for faster cold starts |

**Optimize database queries:**
```sql
-- Add index on frequently queried columns
CREATE INDEX idx_calls_campaign_status ON voice_agent_calls(campaign_id, status);
CREATE INDEX idx_campaign_contacts_pending ON campaign_contacts(campaign_id, status) WHERE status = 'pending';
```

### High Database Usage

**Symptom:** Supabase warns of high egress or query count.

**Solutions:**
1. **Add caching layer** (Redis for frequently accessed data)
2. **Reduce real-time subscriptions** (only subscribe to needed tables)
3. **Batch queries** (fetch multiple campaigns in one query)
4. **Archive old data** (move old transcripts to cold storage)

---

## Deployment Issues

### Vercel Build Failing

**Check build logs:**
```bash
vercel logs --since 1h
```

**Common errors:**

| Error | Solution |
|-------|----------|
| `Module not found` | Run `npm install`, commit package-lock.json |
| `Type error` | Fix TypeScript errors locally first |
| `Out of memory` | Increase Node heap size in vercel.json |

**Example vercel.json:**
```json
{
  "build": {
    "env": {
      "NODE_OPTIONS": "--max-old-space-size=4096"
    }
  }
}
```

### Environment Variables Not Working

**Symptom:** App works locally but not on Vercel.

**Solutions:**
1. Verify env vars in Vercel dashboard: Settings → Environment Variables
2. Redeploy after adding env vars (new build required)
3. Check env var names match exactly (case-sensitive)
4. For client-side vars, ensure they start with `NEXT_PUBLIC_`

---

## Getting Help

### Support Channels

1. **Check documentation first**
   - [README.md](./README.md) - Overview
   - [QUICKSTART.md](./QUICKSTART.md) - Setup guide
   - [API-REFERENCE.md](./API-REFERENCE.md) - API docs

2. **Check external service status**
   - Vapi: status.vapi.ai
   - Vercel: vercel-status.com
   - Supabase: status.supabase.com
   - Twilio: status.twilio.com

3. **Enable debug mode**
   ```bash
   # In .env.local
   DEBUG=true
   LOG_LEVEL=debug
   ```

4. **Collect diagnostic info**
   ```bash
   # Run health check
   curl https://your-app.vercel.app/api/health > health.json

   # Export recent logs
   vercel logs --since 1h > logs.txt

   # Check database stats
   curl "$SUPABASE_URL/rest/v1/rpc/db_stats" -H "apikey: $SUPABASE_ANON_KEY"
   ```

### Reporting Bugs

When reporting issues, include:
- [ ] **Steps to reproduce**
- [ ] **Expected behavior**
- [ ] **Actual behavior**
- [ ] **Error messages** (full text)
- [ ] **Health check output** (`/api/health`)
- [ ] **Recent logs** (last 10 lines)
- [ ] **Environment** (Vercel, local dev, staging)
- [ ] **Timestamp** (when issue occurred)

### Emergency Contacts

**Critical production issues:**
1. Pause all active campaigns: POST /api/campaigns/:id/actions {action: "pause"}
2. Check /api/health for service status
3. Review Vercel logs for errors
4. Investigate external service status pages

**Non-critical issues:**
- Review this troubleshooting guide
- Check documentation
- Test with `/api/health` endpoint
