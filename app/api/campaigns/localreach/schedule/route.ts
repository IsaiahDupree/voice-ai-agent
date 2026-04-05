import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('localreach_niche_schedule')
      .select('*')
      .order('day_of_week', { ascending: true })

    if (error) throw error

    // Group by day of week
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const schedule = dayNames.map((dayName, dayIndex) => {
      const entries = (data || []).filter((e: any) => e.day_of_week === dayIndex)
      return {
        dayOfWeek: dayIndex,
        dayName,
        niches: entries.map((e: any) => ({
          id: e.id,
          niche: e.niche,
          campaignId: e.campaign_id,
          priority: e.priority || 0,
        })),
      }
    })

    return NextResponse.json({
      success: true,
      schedule,
    })
  } catch (error: any) {
    console.error('[Niche Schedule GET API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get schedule' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { schedule } = body

    if (!schedule || !Array.isArray(schedule)) {
      return NextResponse.json(
        { error: 'schedule array is required. Each item: { dayOfWeek, niche, campaignId }' },
        { status: 400 }
      )
    }

    // Validate entries
    for (const entry of schedule) {
      if (entry.dayOfWeek === undefined || !entry.niche || !entry.campaignId) {
        return NextResponse.json(
          { error: 'Each schedule entry requires dayOfWeek (0-6), niche, and campaignId' },
          { status: 400 }
        )
      }

      if (entry.dayOfWeek < 0 || entry.dayOfWeek > 6) {
        return NextResponse.json(
          { error: 'dayOfWeek must be 0 (Sunday) through 6 (Saturday)' },
          { status: 400 }
        )
      }
    }

    // Clear existing schedule and replace
    const { error: deleteError } = await supabaseAdmin
      .from('localreach_niche_schedule')
      .delete()
      .gte('id', 0) // delete all rows

    if (deleteError) throw deleteError

    const rows = schedule.map((entry: any, index: number) => ({
      day_of_week: entry.dayOfWeek,
      niche: entry.niche,
      campaign_id: entry.campaignId,
      priority: entry.priority || index,
      created_at: new Date().toISOString(),
    }))

    const { data, error } = await supabaseAdmin
      .from('localreach_niche_schedule')
      .insert(rows)
      .select()

    if (error) throw error

    return NextResponse.json({
      success: true,
      entriesCreated: data?.length || 0,
      schedule: data,
    })
  } catch (error: any) {
    console.error('[Niche Schedule POST API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to set schedule' },
      { status: 500 }
    )
  }
}
