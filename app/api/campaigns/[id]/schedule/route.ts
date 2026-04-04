// F0228: Campaign scheduling API

import { NextRequest, NextResponse } from 'next/server'
import { scheduleCampaign, cancelScheduledCampaign } from '@/lib/campaign-scheduler'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id, 10)

    if (isNaN(campaignId)) {
      return NextResponse.json({
        error: 'Invalid campaign ID',
      }, { status: 400 })
    }

    const body = await request.json()
    const { scheduled_start, scheduled_end } = body

    if (!scheduled_start) {
      return NextResponse.json({
        error: 'scheduled_start is required (ISO8601 datetime)',
      }, { status: 400 })
    }

    // Validate datetime format
    const startDate = new Date(scheduled_start)
    if (isNaN(startDate.getTime())) {
      return NextResponse.json({
        error: 'Invalid scheduled_start datetime',
      }, { status: 400 })
    }

    // Check if start time is in the future
    if (startDate <= new Date()) {
      return NextResponse.json({
        error: 'scheduled_start must be in the future',
      }, { status: 400 })
    }

    const schedule = await scheduleCampaign(campaignId, scheduled_start, scheduled_end)

    return NextResponse.json({
      success: true,
      schedule,
    })
  } catch (error: any) {
    console.error('Schedule campaign error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to schedule campaign' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id, 10)

    if (isNaN(campaignId)) {
      return NextResponse.json({
        error: 'Invalid campaign ID',
      }, { status: 400 })
    }

    await cancelScheduledCampaign(campaignId)

    return NextResponse.json({
      success: true,
      message: `Campaign ${campaignId} schedule cancelled`,
    })
  } catch (error: any) {
    console.error('Cancel schedule error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel schedule' },
      { status: 500 }
    )
  }
}
