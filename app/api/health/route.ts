export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { vapiClient } from '@/lib/vapi'
import { supabaseAdmin } from '@/lib/supabase'
import { calcomClient } from '@/lib/calcom'
import axios from 'axios'

// F1350: Health check cron
// F1490: Health check failover - retry with exponential backoff
async function checkWithRetry<T>(
  name: string,
  checkFn: () => Promise<T>,
  retries: number = 2,
  baseDelay: number = 1000
): Promise<{ status: 'ok' | 'error'; message?: string }> {
  let lastError: any

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await checkFn()
      return { status: 'ok' }
    } catch (error: any) {
      lastError = error
      console.error(`[Health Check] ${name} failed (attempt ${attempt + 1}/${retries + 1}):`, error.message)

      // Don't delay on last attempt
      if (attempt < retries) {
        const delay = baseDelay * Math.pow(2, attempt) // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  return { status: 'error', message: lastError?.message || 'Unknown error' }
}

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string }> = {}

  // Check Vapi with retry
  checks.vapi = await checkWithRetry('Vapi', async () => {
    await vapiClient.get('/assistant', { timeout: 5000 })
  })

  // Check Supabase with retry
  checks.supabase = await checkWithRetry('Supabase', async () => {
    const { error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('count')
      .limit(1)

    if (error && error.code !== 'PGRST116') { // PGRST116 = table doesn't exist yet
      throw error
    }
  })

  // Check Twilio (if configured) with retry
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    checks.twilio = await checkWithRetry('Twilio', async () => {
      const authString = Buffer.from(
        `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
      ).toString('base64')

      await axios.get(
        `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}.json`,
        {
          headers: { Authorization: `Basic ${authString}` },
          timeout: 5000,
        }
      )
    })
  } else {
    checks.twilio = { status: 'error', message: 'Not configured' }
  }

  // F0300: Cal.com health check with retry
  if (process.env.CALCOM_API_KEY) {
    checks.calcom = await checkWithRetry('Cal.com', async () => {
      const healthResult = await calcomClient.healthCheck()
      if (!healthResult.healthy) {
        throw new Error(healthResult.message || 'Cal.com health check failed')
      }
    })
  } else {
    checks.calcom = { status: 'error', message: 'Not configured' }
  }

  const allHealthy = Object.values(checks).every(c => c.status === 'ok')

  // F1000: API health 200 contract - always return 200
  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: 200 }
  )
}
