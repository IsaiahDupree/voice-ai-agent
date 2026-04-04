// F0230: Live campaign dashboard API

import { NextRequest, NextResponse } from 'next/server'
import { getLiveCampaignMetrics } from '@/lib/campaign-dashboard'

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

    const metrics = await getLiveCampaignMetrics(campaignId)

    return NextResponse.json(metrics)
  } catch (error: any) {
    console.error('Dashboard metrics error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get dashboard metrics' },
      { status: 500 }
    )
  }
}
