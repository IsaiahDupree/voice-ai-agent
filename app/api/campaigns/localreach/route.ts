import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const niche = searchParams.get('niche')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabaseAdmin
      .from('localreach_campaigns')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    if (niche) {
      query = query.eq('niche', niche)
    }

    const { data, error, count } = await query

    if (error) throw error

    // Fetch live stats for each campaign
    const campaigns = data || []
    const campaignIds = campaigns.map((c: any) => c.id)

    let statsMap: Record<string, any> = {}
    if (campaignIds.length > 0) {
      const { data: stats } = await supabaseAdmin
        .from('localreach_campaign_stats')
        .select('*')
        .in('campaign_id', campaignIds)

      if (stats) {
        for (const stat of stats) {
          statsMap[stat.campaign_id] = {
            totalDialed: stat.total_dialed || 0,
            connected: stat.connected || 0,
            appointments: stat.appointments || 0,
            voicemails: stat.voicemails || 0,
            noAnswer: stat.no_answer || 0,
            refused: stat.refused || 0,
            lastDialedAt: stat.last_dialed_at,
          }
        }
      }
    }

    const campaignsWithStats = campaigns.map((c: any) => ({
      ...c,
      stats: statsMap[c.id] || {
        totalDialed: 0,
        connected: 0,
        appointments: 0,
        voicemails: 0,
        noAnswer: 0,
        refused: 0,
        lastDialedAt: null,
      },
    }))

    return NextResponse.json({
      success: true,
      count: count || 0,
      campaigns: campaignsWithStats,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: count ? offset + limit < count : false,
      },
    })
  } catch (error: any) {
    console.error('[LocalReach Campaigns API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list campaigns' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      niche,
      geo_center_lat,
      geo_center_lng,
      geo_radius_miles = 10,
      offer_id,
      assistant_id,
      phone_number_id,
      calling_hours_start = '09:00',
      calling_hours_end = '17:00',
      calling_hours_timezone = 'America/New_York',
      max_calls_per_day = 50,
      schedule_days = [1, 2, 3, 4, 5], // Mon-Fri
      first_message,
      script_template,
      metadata,
    } = body

    if (!name || !niche) {
      return NextResponse.json(
        { error: 'name and niche are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('localreach_campaigns')
      .insert({
        name,
        niche,
        status: 'draft',
        geo_center_lat,
        geo_center_lng,
        geo_radius_miles,
        offer_id,
        assistant_id,
        phone_number_id,
        calling_hours: {
          start: calling_hours_start,
          end: calling_hours_end,
          timezone: calling_hours_timezone,
        },
        max_calls_per_day,
        schedule_days,
        first_message,
        script_template,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error

    // Initialize campaign stats row
    await supabaseAdmin.from('localreach_campaign_stats').insert({
      campaign_id: data.id,
      total_dialed: 0,
      connected: 0,
      appointments: 0,
      voicemails: 0,
      no_answer: 0,
      refused: 0,
    })

    return NextResponse.json(
      { success: true, campaign: data },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('[LocalReach Campaigns API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create campaign' },
      { status: 500 }
    )
  }
}
