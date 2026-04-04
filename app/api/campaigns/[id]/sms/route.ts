// F0549: SMS campaign batch - send post-campaign SMS to all contacted numbers

import { NextRequest, NextResponse } from 'next/server'
import { sendCampaignBatchSMS } from '@/lib/sms-campaign'

/**
 * POST /api/campaigns/:id/sms
 * F0549: Send SMS to all contacts in campaign
 * F0551: Respects timezone (no SMS 9pm-9am local)
 * F0555: Checks for PII before sending
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id, 10)

    if (isNaN(campaignId)) {
      return NextResponse.json(
        { error: 'Invalid campaign ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { message, dryRun, respectTimezone, skipPIICheck } = body

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message body is required' },
        { status: 400 }
      )
    }

    // Send batch SMS
    const result = await sendCampaignBatchSMS(campaignId, message, {
      dryRun: dryRun ?? false,
      respectTimezone: respectTimezone ?? true,
      skipPIICheck: skipPIICheck ?? false,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Campaign SMS API] Error:', error)

    // Return specific error for PII violation
    if (error.message.includes('PII')) {
      return NextResponse.json(
        { error: 'PII detected', message: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
