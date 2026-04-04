// F0403 & F0417: checkAvailability tool with natural language date parsing and multi-day support

import { NextRequest, NextResponse } from 'next/server'
import { calcomClient } from '@/lib/calcom'
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

    // Get availability from Cal.com for date range
    const allSlots: any[] = []
    const slotsByDate = new Map<string, any[]>()

    const currentDate = new Date(parsedStartDate)
    const finalDate = new Date(parsedEndDate)

    while (currentDate <= finalDate) {
      const dateKey = currentDate.toISOString().split('T')[0]

      try {
        const slots = await calcomClient.getAvailability(
          eventTypeId || 1,
          currentDate.toISOString()
        )

        slotsByDate.set(dateKey, slots)
        allSlots.push(...slots.map((slot: any) => ({ ...slot, date: dateKey })))
      } catch (error) {
        console.error(`Error fetching availability for ${dateKey}:`, error)
        slotsByDate.set(dateKey, [])
      }

      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Format response for voice agent
    const datesSummary = Array.from(slotsByDate.entries()).map(([date, slots]) => ({
      date,
      dateFormatted: new Date(date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      }),
      slotsAvailable: slots.length,
      firstSlot: slots[0] ? new Date(slots[0].time).toLocaleTimeString('en-US', {
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
  })
}
