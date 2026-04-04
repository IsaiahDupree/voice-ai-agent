import { NextRequest, NextResponse } from 'next/server'
import { processCampaignBatch } from '@/lib/campaign-dialer'

// F0185: Trigger campaign dialing batch
// F0139: Uses call whisper automatically for each contact
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const {
      maxConcurrentCalls = 5,
      callDelay = 2000,
      respectBusinessHours = true,
    } = body

    const results = await processCampaignBatch({
      campaignId: params.id,
      maxConcurrentCalls,
      callDelay,
      respectBusinessHours,
    })

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error: any) {
    console.error('Error processing campaign batch:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process campaign batch' },
      { status: 500 }
    )
  }
}
