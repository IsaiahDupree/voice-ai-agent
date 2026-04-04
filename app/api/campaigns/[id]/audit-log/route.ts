// F0254: Campaign audit log API

import { NextRequest, NextResponse } from 'next/server'
import { getCampaignAuditLog } from '@/lib/campaign-audit'

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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    const logs = await getCampaignAuditLog(campaignId, limit)

    return NextResponse.json({
      campaign_id: campaignId,
      count: logs.length,
      logs,
    })
  } catch (error: any) {
    console.error('Get audit log error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get audit log' },
      { status: 500 }
    )
  }
}
