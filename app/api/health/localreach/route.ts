export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { vapiClient } from '@/lib/vapi'

async function checkService(
  name: string,
  checkFn: () => Promise<void>
): Promise<{ status: 'ok' | 'error'; message?: string; latencyMs: number }> {
  const start = Date.now()
  try {
    await checkFn()
    return { status: 'ok', latencyMs: Date.now() - start }
  } catch (error: any) {
    return {
      status: 'error',
      message: error.message || 'Unknown error',
      latencyMs: Date.now() - start,
    }
  }
}

export async function GET() {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string; latencyMs: number }> = {}

  // 1. Database connectivity — check LocalReach tables exist
  checks.database = await checkService('Database', async () => {
    const { error } = await supabaseAdmin
      .from('localreach_businesses')
      .select('id', { count: 'exact', head: true })

    if (error && error.code !== 'PGRST116') {
      throw error
    }
  })

  // 2. Google Maps API
  checks.googleMaps = await checkService('Google Maps', async () => {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY
    if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY not configured')

    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=test&key=${apiKey}&location=0,0&radius=1`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()

    // ZERO_RESULTS is fine — means the API key works
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Maps API: ${data.status} - ${data.error_message || ''}`)
    }
  })

  // 3. Vapi connectivity
  checks.vapi = await checkService('Vapi', async () => {
    await vapiClient.get('/assistant', { timeout: 5000 })
  })

  // 4. Twilio SMS
  checks.twilio = await checkService('Twilio', async () => {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) throw new Error('Twilio credentials not configured')

    const authString = Buffer.from(`${sid}:${token}`).toString('base64')
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}.json`,
      {
        headers: { Authorization: `Basic ${authString}` },
        signal: AbortSignal.timeout(5000),
      }
    )

    if (!res.ok) throw new Error(`Twilio API returned ${res.status}`)
  })

  // 5. Calendly
  checks.calendly = await checkService('Calendly', async () => {
    const apiKey = process.env.CALENDLY_API_KEY
    if (!apiKey) throw new Error('CALENDLY_API_KEY not configured')

    const res = await fetch('https://api.calendly.com/users/me', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) throw new Error(`Calendly API returned ${res.status}`)
  })

  // 6. Stripe
  checks.stripe = await checkService('Stripe', async () => {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured')

    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) throw new Error(`Stripe API returned ${res.status}`)
  })

  // Aggregate status
  const allOk = Object.values(checks).every(c => c.status === 'ok')
  const criticalOk = checks.database.status === 'ok' && checks.vapi.status === 'ok'

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : criticalOk ? 'degraded' : 'unhealthy',
      subsystem: 'localreach',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: 200 }
  )
}
