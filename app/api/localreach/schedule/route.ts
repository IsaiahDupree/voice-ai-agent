import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export async function GET(request: NextRequest) {
  try {
    // Fetch weekly schedule
    const { data: schedules, error } = await supabaseAdmin
      .from('localreach_niche_schedule')
      .select('day_of_week, niche, is_active')
      .eq('is_active', true)
      .order('day_of_week', { ascending: true })

    if (error) throw error

    // Build schedule for each day of the week
    const schedule = []
    const today = new Date()
    const currentDayOfWeek = today.getDay()

    for (let i = 0; i < 7; i++) {
      const dayOfWeek = i
      const dayName = DAYS[dayOfWeek]
      const shortName = dayName.slice(0, 3)
      const isToday = dayOfWeek === currentDayOfWeek

      // Find niches for this day
      const daySchedules = (schedules || []).filter((s: any) => s.day_of_week === dayOfWeek)
      const niches = daySchedules.map((s: any) => s.niche)

      schedule.push({
        day: dayName,
        short: shortName,
        niches,
        is_today: isToday,
      })
    }

    return NextResponse.json(schedule)
  } catch (error: any) {
    console.error('[LocalReach Schedule API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch schedule' },
      { status: 500 }
    )
  }
}
