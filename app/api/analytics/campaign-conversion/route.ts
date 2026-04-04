// F0718: GET /api/analytics/campaign-conversion - Campaign conversion rate analytics

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const limit = parseInt(searchParams.get('limit') || '10')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: start_date, end_date' },
        { status: 400 }
      )
    }

    // Get all calls with campaign info in date range
    const { data: calls, error: callsError } = await supabase
      .from('calls')
      .select(`
        id,
        campaign_id,
        duration,
        sentiment,
        created_at,
        campaigns (
          id,
          name
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('campaign_id', 'is', null)

    if (callsError) {
      return NextResponse.json({ error: callsError.message }, { status: 500 })
    }

    // Get all bookings in date range with associated call campaigns
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(`
        id,
        call_id,
        created_at,
        calls!inner (
          campaign_id
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('calls.campaign_id', 'is', null)

    if (bookingsError) {
      return NextResponse.json({ error: bookingsError.message }, { status: 500 })
    }

    // Group calls by campaign
    const campaignStats: {
      [campaignId: string]: {
        campaign_id: string
        campaign_name: string
        total_calls: number
        bookings: number
        total_duration: number
        total_sentiment: number
      }
    } = {}

    calls?.forEach((call: any) => {
      const campaignId = call.campaign_id
      if (!campaignId) return

      if (!campaignStats[campaignId]) {
        campaignStats[campaignId] = {
          campaign_id: campaignId,
          campaign_name: call.campaigns?.name || 'Unnamed Campaign',
          total_calls: 0,
          bookings: 0,
          total_duration: 0,
          total_sentiment: 0,
        }
      }

      campaignStats[campaignId].total_calls++
      campaignStats[campaignId].total_duration += call.duration || 0
      campaignStats[campaignId].total_sentiment += call.sentiment || 0
    })

    // Count bookings per campaign
    bookings?.forEach((booking: any) => {
      const campaignId = booking.calls?.campaign_id
      if (campaignId && campaignStats[campaignId]) {
        campaignStats[campaignId].bookings++
      }
    })

    // Convert to array and calculate conversion rates
    const campaignData = Object.values(campaignStats).map((campaign) => ({
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      total_calls: campaign.total_calls,
      bookings: campaign.bookings,
      conversion_rate: campaign.total_calls > 0
        ? (campaign.bookings / campaign.total_calls) * 100
        : 0,
      avg_duration: campaign.total_calls > 0
        ? campaign.total_duration / campaign.total_calls
        : 0,
      avg_sentiment: campaign.total_calls > 0
        ? campaign.total_sentiment / campaign.total_calls
        : 0,
    }))

    // Sort by conversion rate descending and limit
    const sortedData = campaignData
      .sort((a, b) => b.conversion_rate - a.conversion_rate)
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      data: sortedData,
      meta: {
        start_date: startDate,
        end_date: endDate,
        total_campaigns: campaignData.length,
        showing: sortedData.length,
      },
    })
  } catch (error: any) {
    console.error('Error fetching campaign conversion data:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
