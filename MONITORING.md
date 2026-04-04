# Monitoring & Alerts Guide

**F1397**: How to set up monitoring and alerts for production deployments

---

## Health Checks

### 1. Application Health Endpoint

**GET /api/health**

Returns system status:

```json
{
  "status": "healthy",
  "timestamp": "2026-03-28T12:00:00Z",
  "services": {
    "database": "up",
    "vapi": "up",
    "twilio": "up",
    "calcom": "up",
    "deepgram": "up"
  },
  "version": "1.0.0"
}
```

**Monitoring setup:**

```bash
# Uptime monitoring (cron every 5 min)
*/5 * * * * curl -f https://your-domain.vercel.app/api/health || echo "Health check failed" | mail -s "Alert" admin@example.com
```

**Uptime Robot / Better Uptime:**
- Add `/api/health` endpoint
- Alert on non-200 response
- Check interval: 5 minutes

---

## Key Metrics to Monitor

### 1. Call Metrics

**Dashboard:** `/api/analytics?start_date=today`

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Total calls/day | > 10 | < 5 |
| Avg call duration | 2-5 min | < 30s or > 15min |
| Booking conversion rate | > 15% | < 10% |
| Failed calls | < 5% | > 10% |
| Transfer rate | < 20% | > 30% |

**Query:**

```sql
SELECT
  COUNT(*) as total_calls,
  AVG(duration_seconds) as avg_duration,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as fail_rate
FROM voice_agent_calls
WHERE created_at >= CURRENT_DATE;
```

### 2. Transcript Quality

**Metric:** Average transcript quality score

```sql
SELECT AVG(metadata->>'qualityScore')::float as avg_quality
FROM voice_agent_transcripts
WHERE created_at >= CURRENT_DATE;
```

**Target:** > 80
**Alert if:** < 60

### 3. Response Time

**Vercel Analytics:**
- P50 latency: < 200ms
- P95 latency: < 500ms
- P99 latency: < 1s

**Alerts:**
- P95 > 1s → Investigate database queries
- P99 > 3s → Check API rate limits

### 4. Error Rate

**Vercel Logs:**

```bash
vercel logs --since 1h | grep "Error" | wc -l
```

**Target:** < 10 errors/hour

---

## Logging

### 1. Application Logs

**Vercel Logs:**

```bash
# Live tail
vercel logs --follow

# Filter by function
vercel logs --since 1h | grep "api/calls"

# Export to file
vercel logs --since 24h > logs.txt
```

**Log levels:**
- INFO: Normal operations
- WARN: Recoverable issues (e.g., retries)
- ERROR: Failed requests or critical issues

### 2. Structured Logging

Enable JSON logs in production:

```typescript
// lib/logger.ts
export function logEvent(level: 'info' | 'warn' | 'error', event: string, data: any) {
  console.log(JSON.stringify({
    level,
    event,
    data,
    timestamp: new Date().toISOString(),
  }))
}

// Usage
logEvent('info', 'call.started', { callId, assistantId, phoneNumber })
logEvent('error', 'booking.failed', { error: error.message, callId })
```

### 3. Database Query Logs

**Supabase Studio → Logs:**
- Slow queries (> 1s)
- Failed queries
- Connection pool exhaustion

**Alert on:**
- Query time > 2s
- Connection errors

---

## Alerts

### 1. Critical Alerts (PagerDuty / Opsgenie)

**Trigger on:**
- Health check down > 5 min
- Error rate > 50/hour
- Database connection failure
- Vapi API errors > 10/hour

**Notification:** SMS + Push + Email

### 2. Warning Alerts (Slack / Email)

**Trigger on:**
- Booking conversion < 10%
- Failed calls > 10%
- Transcript quality < 70
- Call volume drops 50% day-over-day

**Notification:** Slack channel

### 3. Usage Alerts

**Trigger on:**
- Approaching Vapi minute limit (e.g., 80% used)
- Twilio balance < $10
- Supabase storage > 80%

---

## Monitoring Tools

### 1. Vercel Analytics (Built-in)

**Free tier includes:**
- Page views
- API request counts
- Error tracking
- Web Vitals

**Enable:**
```bash
vercel env add NEXT_PUBLIC_VERCEL_ANALYTICS_ID
```

### 2. Sentry (Error Tracking)

**Setup:**

```bash
npm install @sentry/nextjs
npx @sentry/wizard -i nextjs
```

**Configure alerts:**
- New error type detected
- Error count > 10/hour
- Unhandled promise rejections

### 3. LogRocket (Session Replay)

**For debugging user issues:**

```bash
npm install logrocket
```

```typescript
import LogRocket from 'logrocket'

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  LogRocket.init('your-app-id')
}
```

### 4. Datadog / New Relic (APM)

**For advanced monitoring:**
- Trace API calls end-to-end
- Database query performance
- External API latency (Vapi, Twilio)
- Custom dashboards

---

## Supabase Monitoring

### 1. Database Size

```sql
SELECT
  pg_size_pretty(pg_database_size('postgres')) as db_size;
```

**Alert if:** > 8GB (free tier limit)

### 2. Table Growth

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
LIMIT 10;
```

### 3. Active Connections

```sql
SELECT count(*) FROM pg_stat_activity;
```

**Free tier limit:** 60 connections
**Alert if:** > 50

### 4. Slow Queries

Enable pg_stat_statements:

```sql
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

---

## External Service Monitoring

### 1. Vapi.ai

**Dashboard:** https://dashboard.vapi.ai

**Monitor:**
- Call success rate
- Average call cost
- Assistant usage
- Function tool invocations

**Alerts:**
- Call failure rate > 5%
- Unexpected cost spike

### 2. Twilio

**Dashboard:** https://console.twilio.com

**Monitor:**
- SMS delivery rate
- SMS error codes (30007, 30008)
- Voice call status
- Account balance

**Alerts:**
- Balance < $10
- SMS delivery rate < 95%

### 3. Cal.com

**Dashboard:** https://app.cal.com/bookings

**Monitor:**
- Booking confirmation rate
- No-show rate
- Average lead time

**Alerts:**
- API errors
- Booking failures > 5%

---

## Custom Monitoring Dashboard

### Build with Supabase + Recharts

**pages/monitoring.tsx:**

```typescript
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LineChart, Line } from 'recharts'

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState([])

  useEffect(() => {
    async function fetchMetrics() {
      const { data } = await supabase
        .from('daily_metrics')
        .select('*')
        .order('date', { ascending: false })
        .limit(30)

      setMetrics(data || [])
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 60000) // Refresh every minute

    return () => clearInterval(interval)
  }, [])

  return (
    <div>
      <h1>System Health</h1>
      <LineChart width={800} height={400} data={metrics}>
        <Line type="monotone" dataKey="total_calls" stroke="#8884d8" />
        <Line type="monotone" dataKey="bookings" stroke="#82ca9d" />
      </LineChart>
    </div>
  )
}
```

---

## Incident Response

### 1. Runbook: Calls Not Connecting

**Symptoms:** Calls fail immediately or don't dial

**Steps:**
1. Check Vapi dashboard for errors
2. Verify API key: `echo $VAPI_API_KEY`
3. Test assistant: `curl /api/vapi/assistant/:id`
4. Check Vercel logs: `vercel logs --since 10m`
5. Fallback: Restart deployment

### 2. Runbook: Database Connection Pool Exhausted

**Symptoms:** 500 errors, "no more connections available"

**Steps:**
1. Check active connections: `SELECT count(*) FROM pg_stat_activity`
2. Kill idle connections:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND state_change < now() - interval '5 minutes';
   ```
3. Increase pool size in `lib/supabase.ts`

### 3. Runbook: High Error Rate

**Symptoms:** Multiple 500 errors in logs

**Steps:**
1. Check Sentry for error patterns
2. Identify common stack trace
3. Roll back last deployment if needed: `vercel rollback`
4. Apply hotfix and redeploy

---

## Performance Benchmarks

**Expected latencies:**

| Endpoint | P50 | P95 | P99 |
|----------|-----|-----|-----|
| GET /api/health | 50ms | 100ms | 200ms |
| POST /api/calls/outbound | 300ms | 800ms | 1500ms |
| GET /api/transcripts/:id | 100ms | 300ms | 500ms |
| POST /api/calendar/booking | 500ms | 1200ms | 2000ms |
| GET /api/analytics | 200ms | 600ms | 1000ms |

**Optimization tips:**
- Add database indexes on frequently queried fields
- Enable Supabase read replicas for heavy read workloads
- Cache analytics queries (5 min TTL)
- Use connection pooling (already enabled in Supabase)
