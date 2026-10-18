import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, formatDailyReport } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/reports/email/test — Send a test daily report email immediately
export async function POST(request: NextRequest) {
  try {
    const { recipient } = await request.json()
    const emailTo = recipient || process.env.ADMIN_EMAIL

    if (!emailTo) {
      return NextResponse.json(
        { error: 'No recipient email provided' },
        { status: 400 }
      )
    }

    const html = formatDailyReport({
      date: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      totalCalls: 42,
      answeredCalls: 38,
      avgDuration: 187,
      avgSentiment: 4.2,
      bookingsCreated: 11,
      smssSent: 25,
      topCampaign: 'Q2 Outreach',
    })

    const result = await sendEmail({
      to: emailTo,
      subject: '[Test] Voice AI Daily Report',
      html,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, recipient: emailTo })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    )
  }
}
