// F0220: Campaign report export API

import { NextRequest, NextResponse } from 'next/server'
import { exportCampaignReport } from '@/lib/campaign-analytics'

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

    const csv = await exportCampaignReport(campaignId)

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="campaign-${campaignId}-report.csv"`,
      },
    })
  } catch (error: any) {
    console.error('Campaign export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export campaign report' },
      { status: 500 }
    )
  }
}
