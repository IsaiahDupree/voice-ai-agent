import { NextRequest, NextResponse } from 'next/server'
import { calcomClient } from '@/lib/calcom'

// F0339: GET /api/cal/availability/multi-host - Query availability across multiple hosts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventTypeIds = searchParams.getAll('eventTypeId')
    const date = searchParams.get('date')

    if (eventTypeIds.length === 0 || !date) {
      return NextResponse.json(
        { error: 'eventTypeIds (array) and date are required' },
        { status: 400 }
      )
    }

    // Fetch availability for all event types
    const availabilityByHost = await Promise.all(
      eventTypeIds.map(async (eventTypeId) => {
        try {
          const slots = await calcomClient.getAvailability(parseInt(eventTypeId), date)
          const slotTimes: string[] = slots.map(s => s.time)
          return {
            eventTypeId: parseInt(eventTypeId),
            available: true,
            slots: slotTimes,
            slotCount: slots.length,
          }
        } catch (error: any) {
          return {
            eventTypeId: parseInt(eventTypeId),
            available: false,
            error: error.message,
            slots: [] as string[],
            slotCount: 0,
          }
        }
      })
    )

    // Find earliest available slot across all hosts
    const allSlots: string[] = availabilityByHost
      .filter(h => h.available)
      .flatMap(h => h.slots)
      .sort()

    const earliestSlot = allSlots.length > 0 ? allSlots[0] : null
    const earliestHost = earliestSlot
      ? availabilityByHost.find(h => h.slots.includes(earliestSlot))
      : null

    return NextResponse.json({
      success: true,
      date,
      hosts: availabilityByHost,
      earliest_available_slot: earliestSlot,
      earliest_available_host: earliestHost?.eventTypeId || null,
      total_unique_slots: new Set(allSlots).size,
    })
  } catch (error: any) {
    console.error('Error fetching multi-host availability:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch availability' },
      { status: 500 }
    )
  }
}
