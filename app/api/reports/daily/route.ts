// F0859: POST /api/reports/daily - Send daily analytics report email
// Typically called by Vercel cron at 8am daily

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, formatDailyReport } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret if provided (for Vercel cron)
    const authHeader = request.headers.get('authorization')
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { date, recipient } = await request.json()
    const targetDate = date || new Date().toISOString().split('T')[0] // Yesterday
    const emailTo = recipient || process.env.ADMIN_EMAIL

    if (!emailTo) {
      return NextResponse.json({ error: 'No recipient email configured (ADMIN_EMAIL env var)' }, { status: 400 })
    }

    // Fetch yesterday's analytics
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString()
    const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString()

    // Get call stats
    const { data: calls } = await supabase
      .from('calls')
      .select('id, duration, sentiment, status')
      .gte('created_at', yesterdayStart)
      .lte('created_at', yesterdayEnd)

    const totalCalls = calls?.length || 0
    const answeredCalls = calls?.filter((c) => c.status === 'completed' || c.status === 'answered').length || 0
    const avgDuration = totalCalls > 0 && calls
      ? calls.reduce((sum, c) => sum + (c.duration || 0), 0) / totalCalls
      : 0
    const avgSentiment = totalCalls > 0 && calls
      ? calls.reduce((sum, c) => sum + (c.sentiment || 0), 0) / totalCalls
      : 0

    // Get booking stats
    const { count: bookingsCreated } = await supabase
      .from('bookings')
      .select('id')
      .gte('created_at', yesterdayStart)
      .lte('created_at', yesterdayEnd)

    // Get SMS stats
    const { count: smssSent } = await supabase
      .from('sms_messages')
      .select('id')
      .gte('created_at', yesterdayStart)
      .lte('created_at', yesterdayEnd)

    // Get top campaign
    const { data: campaigns } = await supabase
      .from('calls')
      .select('campaign_id, campaigns(name)')
      .gte('created_at', yesterdayStart)
      .lte('created_at', yesterdayEnd)
      .not('campaign_id', 'is', null)

    let topCampaign: string | undefined
    if (campaigns && campaigns.length > 0) {
      const campaignCounts = campaigns.reduce((acc: any, call: any) => {
        const name = call.campaigns?.name || 'Unknown'
        acc[name] = (acc[name] || 0) + 1
        return acc
      }, {})
      topCampaign = Object.entries(campaignCounts).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] as string
    }

    // Format and send email
    const html = formatDailyReport({
      date: yesterday.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      totalCalls,
      answeredCalls,
      avgDuration,
      avgSentiment,
      bookingsCreated: bookingsCreated || 0,
      smssSent: smssSent || 0,
      topCampaign,
    })

    const result = await sendEmail({
      to: emailTo,
      subject: `📊 Daily Voice AI Report - ${yesterday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
      html,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Daily report sent',
      recipient: emailTo,
      stats: {
        totalCalls,
        answeredCalls,
        bookingsCreated: bookingsCreated || 0,
        smssSent: smssSent || 0,
      },
    })
  } catch (error: any) {
    console.error('Error sending daily report:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// F0859: Allow GET for manual triggers
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const recipient = searchParams.get('recipient') || process.env.ADMIN_EMAIL

  if (!recipient) {
    return NextResponse.json({ error: 'No recipient email provided' }, { status: 400 })
  }

  // Forward to POST handler
  return POST(
    new NextRequest(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ recipient }),
    })
  )
}
