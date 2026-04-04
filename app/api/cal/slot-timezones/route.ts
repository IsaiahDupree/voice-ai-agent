import { NextRequest, NextResponse } from 'next/server'
import { calcomClient } from '@/lib/calcom'

// F0346: GET /api/cal/slot-timezones - Display slot in both agent and caller timezone
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

    // Get available slots
    const slots = await calcomClient.getAvailability(parseInt(eventTypeId), date)

    // Format slots with both timezones
    const slotsWithTimezones = slots.map((slot) => {
      const slotTime = new Date(slot.time)

      // Get offset difference between timezones
      const agentFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: agentTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })

      const callerFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: callerTimezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })

      return {
        slot_time_iso: slot.time,
        agent_timezone: {
          name: agentTimezone,
          time_display: agentFormatter.format(slotTime),
        },
        caller_timezone: {
          name: callerTimezone,
          time_display: callerFormatter.format(slotTime),
        },
      }
    })

    return NextResponse.json({
      success: true,
      eventTypeId: parseInt(eventTypeId),
      date,
      agent_timezone: agentTimezone,
      caller_timezone: callerTimezone,
      slots: slotsWithTimezones,
      count: slotsWithTimezones.length,
    })
  } catch (error: any) {
    console.error('Error fetching slot timezones:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch slots' },
      { status: 500 }
    )
  }
}
