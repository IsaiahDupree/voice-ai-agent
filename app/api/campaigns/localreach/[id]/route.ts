import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data: campaign, error } = await supabaseAdmin
      .from('localreach_campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      }
      throw error
    }

    // Fetch live stats
    const { data: stats } = await supabaseAdmin
      .from('localreach_campaign_stats')
      .select('*')
      .eq('campaign_id', id)
      .single()

    // Fetch recent call activity
    const { data: recentCalls } = await supabaseAdmin
      .from('localreach_call_log')
      .select('id, business_id, outcome, duration_seconds, called_at')
      .eq('campaign_id', id)
      .order('called_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      campaign: {
        ...campaign,
        stats: stats
          ? {
              totalDialed: stats.total_dialed || 0,
              connected: stats.connected || 0,
              appointments: stats.appointments || 0,
              voicemails: stats.voicemails || 0,
              noAnswer: stats.no_answer || 0,
              refused: stats.refused || 0,
              lastDialedAt: stats.last_dialed_at,
            }
          : null,
        recentCalls: recentCalls || [],
      },
    })
  } catch (error: any) {
    console.error('[LocalReach Campaign GET API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get campaign' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    const allowedFields = [
      'name', 'niche', 'geo_center_lat', 'geo_center_lng', 'geo_radius_miles',
      'offer_id', 'assistant_id', 'phone_number_id', 'calling_hours',
      'max_calls_per_day', 'schedule_days', 'first_message', 'script_template',
      'metadata',
    ]

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field]
      }
    }

    // Handle calling hours as nested object
    if (body.calling_hours_start || body.calling_hours_end || body.calling_hours_timezone) {
      // Fetch current to merge
      const { data: current } = await supabaseAdmin
        .from('localreach_campaigns')
        .select('calling_hours')
        .eq('id', id)
        .single()

      const currentHours = current?.calling_hours || {}
      updates.calling_hours = {
        start: body.calling_hours_start || currentHours.start || '09:00',
        end: body.calling_hours_end || currentHours.end || '17:00',
        timezone: body.calling_hours_timezone || currentHours.timezone || 'America/New_York',
      }
    }

    const { data, error } = await supabaseAdmin
      .from('localreach_campaigns')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({ success: true, campaign: data })
  } catch (error: any) {
    console.error('[LocalReach Campaign PATCH API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update campaign' },
      { status: 500 }
    )
  }
}
