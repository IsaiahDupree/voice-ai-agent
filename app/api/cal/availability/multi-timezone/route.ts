import { NextRequest, NextResponse } from 'next/server'
import { calcomClient } from '@/lib/calcom'

// F0328: GET /api/cal/availability/multi-timezone - Show slots in multiple timezones
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventTypeId = searchParams.get('eventTypeId')
    const date = searchParams.get('date')
    const agentTimezone = searchParams.get('agentTimezone') || 'America/New_York'
    const callerTimezone = searchParams.get('callerTimezone') || 'America/Los_Angeles'

    if (!eventTypeId || !date) {
      return NextResponse.json(
        { error: 'eventTypeId and date are required' },
        { status: 400 }
      )
    }

    // Get availability in the specified date
    const slots = await calcomClient.getAvailability(parseInt(eventTypeId), date)

    // Format slots to show in both timezones
    const formattedSlots = slots.map((slot) => {
      const slotTime = new Date(slot.time)

      // Format for agent timezone
      const agentTimeFormatted = slotTime.toLocaleString('en-US', {
        timeZone: agentTimezone,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })

      // Format for caller timezone
      const callerTimeFormatted = slotTime.toLocaleString('en-US', {
        timeZone: callerTimezone,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })

      return {
        time: slot.time,
        agent_timezone: {
          timezone: agentTimezone,
          formatted: agentTimeFormatted,
        },
        caller_timezone: {
          timezone: callerTimezone,
          formatted: callerTimeFormatted,
        },
      }
    })

    return NextResponse.json({
      success: true,
      eventTypeId: parseInt(eventTypeId),
      date,
      agent_timezone: agentTimezone,
      caller_timezone: callerTimezone,
      slots: formattedSlots,
      count: formattedSlots.length,
    })
  } catch (error: any) {
    console.error('Error fetching multi-timezone availability:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}
