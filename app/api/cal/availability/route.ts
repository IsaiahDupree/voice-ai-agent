import { NextRequest, NextResponse } from 'next/server'
import { calcomClient } from '@/lib/calcom'

// F0273: Get availability - Returns available time slots for a specific event type and date

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventTypeId = searchParams.get('eventTypeId')
    const date = searchParams.get('date')
    const window = searchParams.get('window') // F0274: 7-day window
    const timezone = searchParams.get('timezone') || 'America/New_York' // F0276: Timezone

    if (!eventTypeId) {
      return NextResponse.json(
        { error: 'eventTypeId parameter is required' },
        { status: 400 }
      )
    }

    // F0274: If window=7d is specified, return 7-day availability
    if (window === '7d' || window === '7') {
      const slotsByDate = await calcomClient.getAvailabilityWindow(
        parseInt(eventTypeId),
        timezone
      )

      return NextResponse.json({
        success: true,
        eventTypeId: parseInt(eventTypeId),
        timezone, // F0276: Slots returned in specified timezone
        window: '7 days',
        slots_by_date: slotsByDate,
        total_days: Object.keys(slotsByDate).length
      })
    }

    // Original single-day availability
    if (!date) {
      return NextResponse.json(
        { error: 'date parameter is required (or use window=7d for 7-day availability)' },
        { status: 400 }
      )
    }

    // F0275: Slots returned as ISO8601 datetime strings
    const slots = await calcomClient.getAvailability(parseInt(eventTypeId), date)

    return NextResponse.json({
      success: true,
      date,
      eventTypeId: parseInt(eventTypeId),
      slots,
      count: slots.length,
    })
  } catch (error: any) {
    console.error('Error fetching availability:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}
