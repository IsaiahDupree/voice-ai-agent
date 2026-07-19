// F0210: Campaign progress tracking API
// F0213: Campaign conversion rate API
// F0246: Cost per call tracking API

import { NextRequest, NextResponse } from 'next/server'
import { getCampaignStats } from '@/lib/campaign-analytics'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

  try {
    const campaignId = parseInt(id, 10)

    if (isNaN(campaignId)) {
      return NextResponse.json({
        error: 'Invalid campaign ID',
      }, { status: 400 })
    }

    const stats = await getCampaignStats(campaignId)

    return NextResponse.json(stats)
  } catch (error: any) {
    console.error('Campaign stats error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get campaign stats' },
      { status: 500 }
    )
  }
}
