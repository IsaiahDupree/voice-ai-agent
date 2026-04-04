// F0879: GET /api/analytics/booking-show-rate - % bookings that resulted in attended meeting

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

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: start_date, end_date' },
        { status: 400 }
      )
    }

    // Get all bookings in date range
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, status, start_time, end_time, metadata')
      .gte('created_at', startDate)
      .lte('created_at', endDate)

    if (bookingsError) {
      return NextResponse.json({ error: bookingsError.message }, { status: 500 })
    }

    const totalBookings = bookings?.length || 0

    // Count bookings by status
    // Assume metadata contains 'attended' field from Cal.com webhook
    const attendedBookings = bookings?.filter(
      (b: any) => b.status === 'attended' || b.metadata?.attended === true
    ).length || 0

    const noShowBookings = bookings?.filter(
      (b: any) => b.status === 'no_show' || b.metadata?.attended === false
    ).length || 0

    const cancelledBookings = bookings?.filter(
      (b: any) => b.status === 'cancelled'
    ).length || 0

    const pendingBookings = bookings?.filter(
      (b: any) =>
        !['attended', 'no_show', 'cancelled'].includes(b.status) &&
        new Date(b.start_time) > new Date()
    ).length || 0

    // Calculate show rate (attended / total non-cancelled bookings)
    const eligibleBookings = totalBookings - cancelledBookings
    const showRate = eligibleBookings > 0 ? (attendedBookings / eligibleBookings) * 100 : 0
    const noShowRate = eligibleBookings > 0 ? (noShowBookings / eligibleBookings) * 100 : 0

    // Group by campaign if bookings have campaign_id via calls table
    const { data: campaignBreakdown } = await supabase
      .from('bookings')
      .select(`
        id,
        status,
        metadata,
        calls!inner (
          campaign_id,
          campaigns (
            id,
            name
          )
        )
      `)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .not('calls.campaign_id', 'is', null)

    // Calculate show rate per campaign
    const campaignStats: {
      [campaignId: string]: {
        campaign_name: string
        total: number
        attended: number
        no_show: number
        show_rate: number
      }
    } = {}

    campaignBreakdown?.forEach((booking: any) => {
      const campaignId = booking.calls?.campaign_id
      if (!campaignId) return

      if (!campaignStats[campaignId]) {
        campaignStats[campaignId] = {
          campaign_name: booking.calls?.campaigns?.name || 'Unknown',
          total: 0,
          attended: 0,
          no_show: 0,
          show_rate: 0,
        }
      }

      campaignStats[campaignId].total++

      if (booking.status === 'attended' || booking.metadata?.attended === true) {
        campaignStats[campaignId].attended++
      } else if (booking.status === 'no_show' || booking.metadata?.attended === false) {
        campaignStats[campaignId].no_show++
      }
    })

    // Calculate show rates per campaign
    Object.values(campaignStats).forEach((stats) => {
      stats.show_rate = stats.total > 0 ? (stats.attended / stats.total) * 100 : 0
    })

    return NextResponse.json({
      success: true,
      data: {
        overall: {
          total_bookings: totalBookings,
          attended: attendedBookings,
          no_show: noShowBookings,
          cancelled: cancelledBookings,
          pending: pendingBookings,
          show_rate: showRate,
          no_show_rate: noShowRate,
        },
        by_campaign: Object.entries(campaignStats).map(([id, stats]) => ({
          campaign_id: id,
          ...stats,
        })),
      },
      meta: {
        start_date: startDate,
        end_date: endDate,
      },
    })
  } catch (error: any) {
    console.error('Error fetching booking show rate:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
