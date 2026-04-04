// F0225: Campaign rate limit API

import { NextRequest, NextResponse } from 'next/server'
import { setRateLimit, checkRateLimit } from '@/lib/campaign-rate-limit'

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

    const status = await checkRateLimit(campaignId)

    return NextResponse.json(status)
  } catch (error: any) {
    console.error('Check rate limit error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check rate limit' },
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
    const { max_calls_per_hour } = body

    if (!max_calls_per_hour || max_calls_per_hour < 1 || max_calls_per_hour > 1000) {
      return NextResponse.json({
        error: 'max_calls_per_hour must be between 1 and 1000',
      }, { status: 400 })
    }

    await setRateLimit(campaignId, max_calls_per_hour)

    const status = await checkRateLimit(campaignId)

    return NextResponse.json({
      success: true,
      status,
    })
  } catch (error: any) {
    console.error('Set rate limit error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to set rate limit' },
      { status: 500 }
    )
  }
}
