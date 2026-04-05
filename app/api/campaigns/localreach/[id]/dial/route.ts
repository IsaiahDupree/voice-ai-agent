import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { dialNextBusiness } from '@/lib/localreach/calling-engine'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Fetch campaign
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('localreach_campaigns')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      }
      throw fetchError
    }

    if (campaign.status !== 'active') {
      return NextResponse.json(
        { error: `Campaign is "${campaign.status}" — must be "active" to dial` },
        { status: 409 }
      )
    }

    // Enforce daily quota
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: todayCallCount, error: countError } = await supabaseAdmin
      .from('localreach_call_log')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', id)
      .gte('called_at', todayStart.toISOString())

    if (countError) throw countError

    const maxCallsPerDay = campaign.max_calls_per_day || 50
    if ((todayCallCount || 0) >= maxCallsPerDay) {
      return NextResponse.json(
        {
          error: 'Daily call quota reached',
          quota: {
            max: maxCallsPerDay,
            used: todayCallCount,
            remaining: 0,
          },
        },
        { status: 429 }
      )
    }

    // Check calling hours
    const callingHours = campaign.calling_hours || { start: '09:00', end: '17:00', timezone: 'America/New_York' }
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: callingHours.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const currentTime = formatter.format(now)

    if (currentTime < callingHours.start || currentTime >= callingHours.end) {
      return NextResponse.json(
        {
          error: 'Outside calling hours',
          callingHours: {
            start: callingHours.start,
            end: callingHours.end,
            timezone: callingHours.timezone,
            currentTime,
          },
        },
        { status: 403 }
      )
    }

    // Dial the next business (calling-engine fetches campaign internally)
    const result = await dialNextBusiness(id)

    return NextResponse.json({
      success: true,
      campaignId: id,
      dial: result,
      quota: {
        max: maxCallsPerDay,
        used: (todayCallCount || 0) + 1,
        remaining: maxCallsPerDay - (todayCallCount || 0) - 1,
      },
    })
  } catch (error: any) {
    console.error('[Campaign Dial API] Error:', error)

    if (error.message?.includes('No businesses remaining')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to dial' },
      { status: 500 }
    )
  }
}
