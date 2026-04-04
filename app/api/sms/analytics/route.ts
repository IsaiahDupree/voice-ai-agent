// F0538: SMS analytics API

import { NextRequest, NextResponse } from 'next/server'
import { getSMSAnalytics, getCampaignSMSAnalytics, getRecentSMSFailures } from '@/lib/sms-analytics'

/**
 * GET /api/sms/analytics?startDate=X&endDate=Y&campaignId=Z
 * F0538: Returns SMS sent/delivered/failed counts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined
    const campaignIdStr = searchParams.get('campaignId')
    const contactIdStr = searchParams.get('contactId')

    const campaignId = campaignIdStr ? parseInt(campaignIdStr, 10) : undefined
    const contactId = contactIdStr ? parseInt(contactIdStr, 10) : undefined

    // If campaign ID provided, use campaign-specific analytics
    if (campaignId) {
      const analytics = await getCampaignSMSAnalytics(campaignId)
      return NextResponse.json(analytics)
    }

    // Otherwise, use general analytics with filters
    const analytics = await getSMSAnalytics({
      startDate,
      endDate,
      contactId,
      campaignId,
    })

    return NextResponse.json(analytics)
  } catch (error: any) {
    console.error('[SMS Analytics API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
