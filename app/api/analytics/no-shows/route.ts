// F0267: No-show analysis - List contacts who no-showed with follow-up flag

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const contactId = searchParams.get('contact_id')
    const campaignId = searchParams.get('campaign_id')
    const followupSent = searchParams.get('followup_sent') // 'true', 'false', or null
    const sortBy = searchParams.get('sort_by') || 'detected_at' // 'detected_at', 'scheduled_time', 'no_show_count'
    const order = searchParams.get('order') || 'desc' // 'asc' or 'desc'
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query for no-shows with contact details
    let query = supabaseAdmin
      .from('booking_no_shows')
      .select(`
        *,
        bookings!inner (
          id,
          title,
          start_time,
          end_time,
          call_id,
          calls (
            id,
            campaign_id,
            campaigns (
              id,
              name
            )
          )
        ),
        contacts!inner (
          id,
          full_name,
          phone_number,
          email,
          company,
          no_show_count,
          last_no_show_at,
          tags
        )
      `)

    // Apply filters
    if (startDate) {
      query = query.gte('detected_at', startDate)
    }
    if (endDate) {
      query = query.lte('detected_at', endDate)
    }
    if (contactId) {
      query = query.eq('contact_id', contactId)
    }
    if (followupSent === 'true') {
      query = query.eq('followup_sent', true)
    } else if (followupSent === 'false') {
      query = query.eq('followup_sent', false)
    }

    // If filtering by campaign, we need a different approach since campaign_id is nested
    let campaignFilteredIds: string[] | null = null
    if (campaignId) {
      const { data: campaignBookings } = await supabaseAdmin
        .from('bookings')
        .select('id, calls!inner(campaign_id)')
        .eq('calls.campaign_id', campaignId)

      if (campaignBookings) {
        campaignFilteredIds = campaignBookings.map((b: any) => b.id)
        if (campaignFilteredIds.length > 0) {
          query = query.in('booking_id', campaignFilteredIds)
        } else {
          // No bookings for this campaign - return empty result
          return NextResponse.json({
            success: true,
            data: [],
            meta: {
              total: 0,
              limit,
              offset,
              filters_applied: {
                start_date: startDate,
                end_date: endDate,
                contact_id: contactId,
                campaign_id: campaignId,
                followup_sent: followupSent,
              },
            },
          })
        }
      }
    }

    // Get total count with a separate count-only query (clone filters)
    let countQuery = supabaseAdmin
      .from('booking_no_shows')
      .select('*', { count: 'exact', head: true })

    if (startDate) {
      countQuery = countQuery.gte('detected_at', startDate)
    }
    if (endDate) {
      countQuery = countQuery.lte('detected_at', endDate)
    }
    if (contactId) {
      countQuery = countQuery.eq('contact_id', contactId)
    }
    if (followupSent === 'true') {
      countQuery = countQuery.eq('followup_sent', true)
    } else if (followupSent === 'false') {
      countQuery = countQuery.eq('followup_sent', false)
    }
    if (campaignFilteredIds !== null && campaignFilteredIds.length > 0) {
      countQuery = countQuery.in('booking_id', campaignFilteredIds)
    }

    const { count: totalCount } = await countQuery

    // Apply sorting and pagination
    if (sortBy === 'no_show_count') {
      // Special case: sort by contact no_show_count
      query = query.order('contacts.no_show_count', { ascending: order === 'asc' })
    } else {
      query = query.order(sortBy as any, { ascending: order === 'asc' })
    }

    query = query.range(offset, offset + limit - 1)

    const { data: noShows, error } = await query

    if (error) {
      console.error('Error fetching no-shows:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Transform data to flatten nested relationships
    const transformedData = noShows?.map((ns: any) => ({
      id: ns.id,
      booking_id: ns.booking_id,
      contact_id: ns.contact_id,
      scheduled_time: ns.scheduled_time,
      detected_at: ns.detected_at,
      auto_detected: ns.auto_detected,
      followup_sent: ns.followup_sent,
      followup_sent_at: ns.followup_sent_at,
      notes: ns.notes,
      booking: {
        id: ns.bookings?.id,
        title: ns.bookings?.title,
        start_time: ns.bookings?.start_time,
        end_time: ns.bookings?.end_time,
        call_id: ns.bookings?.call_id,
      },
      campaign: ns.bookings?.calls?.campaigns ? {
        id: ns.bookings.calls.campaigns.id,
        name: ns.bookings.calls.campaigns.name,
      } : null,
      contact: {
        id: ns.contacts.id,
        full_name: ns.contacts.full_name,
        phone_number: ns.contacts.phone_number,
        email: ns.contacts.email,
        company: ns.contacts.company,
        no_show_count: ns.contacts.no_show_count,
        last_no_show_at: ns.contacts.last_no_show_at,
        tags: ns.contacts.tags,
      },
    })) || []

    // Calculate summary statistics
    const followupSentCount = transformedData.filter(ns => ns.followup_sent).length
    const followupPendingCount = transformedData.filter(ns => !ns.followup_sent).length
    const autoDetectedCount = transformedData.filter(ns => ns.auto_detected).length

    return NextResponse.json({
      success: true,
      data: transformedData,
      meta: {
        total: totalCount || 0,
        limit,
        offset,
        returned: transformedData.length,
        filters_applied: {
          start_date: startDate,
          end_date: endDate,
          contact_id: contactId,
          campaign_id: campaignId,
          followup_sent: followupSent,
          sort_by: sortBy,
          order,
        },
      },
      summary: {
        total_no_shows: totalCount || 0,
        followup_sent: followupSentCount,
        followup_pending: followupPendingCount,
        auto_detected: autoDetectedCount,
        manual_marked: transformedData.length - autoDetectedCount,
      },
    })
  } catch (error: any) {
    console.error('Error in no-show analysis:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
