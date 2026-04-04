// F0205: Retry delay configuration API
// F0207: Retry on busy API
// F0208: Retry on voicemail API
// F0199: Voicemail drop text API

import { NextRequest, NextResponse } from 'next/server'
import { getRetryConfig, setRetryConfig } from '@/lib/campaign-retry'

export async function GET(
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

    const config = await getRetryConfig(campaignId)

    return NextResponse.json(config)
  } catch (error: any) {
    console.error('Get retry config error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get retry configuration' },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    // Validate retry_delay_minutes
    if (body.retry_delay_minutes !== undefined) {
      if (body.retry_delay_minutes < 5 || body.retry_delay_minutes > 1440) {
        return NextResponse.json({
          error: 'retry_delay_minutes must be between 5 and 1440 (24 hours)',
        }, { status: 400 })
      }
    }

    // Validate max_attempts
    if (body.max_attempts !== undefined) {
      if (body.max_attempts < 1 || body.max_attempts > 10) {
        return NextResponse.json({
          error: 'max_attempts must be between 1 and 10',
        }, { status: 400 })
      }
    }

    await setRetryConfig({
      campaign_id: campaignId,
      ...body,
    })

    const updatedConfig = await getRetryConfig(campaignId)

    return NextResponse.json({
      success: true,
      config: updatedConfig,
    })
  } catch (error: any) {
    console.error('Update retry config error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update retry configuration' },
      { status: 500 }
    )
  }
}
