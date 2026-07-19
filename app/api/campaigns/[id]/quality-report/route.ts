// F0252: Campaign call quality report API

import { NextRequest, NextResponse } from 'next/server'
import { getCampaignQualityReport } from '@/lib/call-quality-monitoring'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const report = await getCampaignQualityReport(
      parseInt(id),
      startDate || undefined,
      endDate || undefined
    )

    return NextResponse.json({
      success: true,
      campaign_id: id,
      report,
    })
  } catch (error: any) {
    console.error('Error generating quality report:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate quality report' },
      { status: 500 }
    )
  }
}
