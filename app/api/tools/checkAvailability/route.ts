// F0403 & F0417: checkAvailability tool with natural language date parsing and multi-day support
// F197: Updated to use SchedulingProvider abstraction

import { NextRequest, NextResponse } from 'next/server'
import { getSchedulingProvider } from '@/lib/scheduling'
import { parseNaturalDate } from '@/lib/date-parser'
import { withTelemetry } from '@/lib/tool-telemetry'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { date, eventTypeId, timezone, days = 1, endDate } = body

  return withTelemetry('checkAvailability', body.callId, body, async () => {
    if (!date) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      )
    }

    // F0403: Parse natural language date to ISO8601
    let parsedStartDate: string
    try {
      parsedStartDate = parseNaturalDate(date, timezone || 'America/New_York')
    } catch (parseError: any) {
      return NextResponse.json(
        { error: parseError.message },
        { status: 400 }
      )
    }

    // F0417: Multi-day availability check
    let parsedEndDate: string
    if (endDate) {
      // Specific end date provided
      try {
        parsedEndDate = parseNaturalDate(endDate, timezone || 'America/New_York')
      } catch (parseError: any) {
        return NextResponse.json(
          { error: `Invalid end date: ${parseError.message}` },
          { status: 400 }
        )
      }
    } else {
      // Calculate end date based on days parameter
      const startDate = new Date(parsedStartDate)
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + (days - 1))
      parsedEndDate = endDate.toISOString()
    }

    // Get availability using configured scheduling provider
    const provider = getSchedulingProvider()

    try {
      const availabilityResult = await provider.checkAvailability({
        start_date: parsedStartDate,
        end_date: parsedEndDate,
        duration_minutes: 30, // Default 30 min appointments
        timezone: timezone || 'America/New_York',
        event_type_id: eventTypeId?.toString(),
      })

      // Group slots by date for summary
      const slotsByDate = new Map<string, typeof availabilityResult.slots>()
      const allSlots = availabilityResult.slots.filter((slot) => slot.available)

      allSlots.forEach((slot) => {
        const dateKey = slot.start.split('T')[0]
        if (!slotsByDate.has(dateKey)) {
          slotsByDate.set(dateKey, [])
        }
        slotsByDate.get(dateKey)!.push(slot)
      })

      // Format response for voice agent
      const datesSummary = Array.from(slotsByDate.entries()).map(([date, slots]) => ({
        date,
        dateFormatted: new Date(date).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        }),
        slotsAvailable: slots.length,
        firstSlot: slots[0] ? new Date(slots[0].start).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: timezone || 'America/New_York'
        }) : null
      }))

      const totalSlots = allSlots.length
      const daysWithSlots = datesSummary.filter(d => d.slotsAvailable > 0).length

      const response = {
        success: true,
        dateRange: {
          start: parsedStartDate,
          end: parsedEndDate,
          days: datesSummary.length
        },
        totalSlots,
        daysWithSlots,
        datesSummary,
        message: totalSlots > 0
          ? `I found ${totalSlots} available time slots across ${daysWithSlots} day${daysWithSlots === 1 ? '' : 's'}.`
          : `Unfortunately, there are no available times in the requested date range. Would you like to try different dates?`
      }

      return NextResponse.json(response)
    } catch (error) {
      console.error('Availability check failed:', error)
      return NextResponse.json(
        { error: 'Failed to check availability. Please try again.' },
        { status: 500 }
      )
    }
  })
}
