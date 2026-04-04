// F0161: CSAT survey API endpoints

import { NextRequest, NextResponse } from 'next/server'
import {
  recordCSATResponse,
  getCSATConfig,
  updateCSATConfig,
  getCSATStats,
  DEFAULT_CSAT_CONFIG,
} from '@/lib/csat-survey'

/**
 * POST /api/csat
 * Record a CSAT survey response
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { callId, contactId, rating, feedback, surveyConfig } = body

    if (!callId || rating === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: callId, rating' },
        { status: 400 }
      )
    }

    const result = await recordCSATResponse({
      callId,
      contactId,
      rating: Number(rating),
      feedback,
      surveyConfig: surveyConfig || DEFAULT_CSAT_CONFIG,
    })

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to record survey response' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      surveyId: result.surveyId,
      message: 'Survey response recorded',
    })
  } catch (error: any) {
    console.error('Error recording CSAT:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to record survey' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/csat/config?assistantId=xxx
 * Get CSAT configuration for an assistant
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const assistantId = searchParams.get('assistantId')
    const action = searchParams.get('action')

    // Get stats
    if (action === 'stats') {
      const dateFrom = searchParams.get('dateFrom') || undefined
      const dateTo = searchParams.get('dateTo') || undefined

      const stats = await getCSATStats({
        assistantId: assistantId || undefined,
        dateFrom,
        dateTo,
      })

      return NextResponse.json(stats)
    }

    // Get config
    if (!assistantId) {
      return NextResponse.json(
        { error: 'Missing assistantId parameter' },
        { status: 400 }
      )
    }

    const config = await getCSATConfig(assistantId)
    return NextResponse.json(config)
  } catch (error: any) {
    console.error('Error fetching CSAT data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch CSAT data' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/csat/config
 * Update CSAT configuration for an assistant
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { assistantId, config } = body

    if (!assistantId || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: assistantId, config' },
        { status: 400 }
      )
    }

    const result = await updateCSATConfig(assistantId, config)

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to update config' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'CSAT config updated',
    })
  } catch (error: any) {
    console.error('Error updating CSAT config:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update config' },
      { status: 500 }
    )
  }
}
