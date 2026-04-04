// F0860: POST /api/reports/weekly - Send weekly analytics report email
// Typically called by Vercel cron on Monday at 8am

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEmail, formatWeeklyReport } from '@/lib/email'

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

    const { recipient } = await request.json()
    const emailTo = recipient || process.env.ADMIN_EMAIL

    if (!emailTo) {
      return NextResponse.json({ error: 'No recipient email configured (ADMIN_EMAIL env var)' }, { status: 400 })
    }

    // Calculate last week's date range (Monday-Sunday)
    const today = new Date()
    const dayOfWeek = today.getDay()
    const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek + 6 // Last Monday
    const lastMonday = new Date(today)
    lastMonday.setDate(today.getDate() - daysToLastMonday)
    lastMonday.setHours(0, 0, 0, 0)

    const lastSunday = new Date(lastMonday)
    lastSunday.setDate(lastMonday.getDate() + 6)
    lastSunday.setHours(23, 59, 59, 999)

    const weekStart = lastMonday.toISOString()
    const weekEnd = lastSunday.toISOString()

    // Get call stats for the week
    const { data: calls } = await supabase
      .from('calls')
      .select('id, duration, sentiment, status, campaign_id, campaigns(name), created_at')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)

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
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)

    // Get SMS stats
    const { count: smssSent } = await supabase
      .from('sms_messages')
      .select('id')
      .gte('created_at', weekStart)
      .lte('created_at', weekEnd)

    // Get top campaigns
    const campaignCounts: { [key: string]: number } = {}
    calls?.forEach((call: any) => {
      if (call.campaign_id) {
        const name = call.campaigns?.name || 'Unknown Campaign'
        campaignCounts[name] = (campaignCounts[name] || 0) + 1
      }
    })
    const topCampaigns = Object.entries(campaignCounts)
      .map(([name, calls]) => ({ name, calls }))
      .sort((a, b) => b.calls - a.calls)

    // Get daily breakdown
    const dailyBreakdown: Array<{ date: string; calls: number }> = []
    for (let i = 0; i < 7; i++) {
      const day = new Date(lastMonday)
      day.setDate(lastMonday.getDate() + i)
      const dayStart = new Date(day.setHours(0, 0, 0, 0)).toISOString()
      const dayEnd = new Date(day.setHours(23, 59, 59, 999)).toISOString()

      const dayCalls = calls?.filter(
        (c: any) => c.created_at >= dayStart && c.created_at <= dayEnd
      ).length || 0

      dailyBreakdown.push({
        date: dayStart,
        calls: dayCalls,
      })
    }

    // Format and send email
    const html = formatWeeklyReport({
      weekStart: lastMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      weekEnd: lastSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      totalCalls,
      answeredCalls,
      avgDuration,
      avgSentiment,
      bookingsCreated: bookingsCreated || 0,
      smssSent: smssSent || 0,
      topCampaigns,
      dailyBreakdown,
    })

    const result = await sendEmail({
      to: emailTo,
      subject: `📈 Weekly Voice AI Report - Week of ${lastMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      html,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Weekly report sent',
      recipient: emailTo,
      stats: {
        weekStart,
        weekEnd,
        totalCalls,
        answeredCalls,
        bookingsCreated: bookingsCreated || 0,
        smssSent: smssSent || 0,
      },
    })
  } catch (error: any) {
    console.error('Error sending weekly report:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// F0860: Allow GET for manual triggers
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
