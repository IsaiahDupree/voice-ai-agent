// F0293: Collective booking - find times when multiple attendees are all free

import { calcomClient, type CalComSlot, type BookingParams, type CalComBooking } from './calcom'

export interface CollectiveAttendee {
  eventTypeId: number // Their personal event type to check availability
  name: string
  email: string
  required: boolean // If true, meeting can't happen without them
}

export interface CollectiveBookingParams {
  attendees: CollectiveAttendee[]
  duration: number // Meeting duration in minutes
  startDate: string // Start searching from this date
  endDate: string // Search up to this date
  preferredTimes?: string[] // Optional: preferred time slots (e.g., ["09:00", "14:00"])
  timeZone?: string
}

export interface CollectiveSlot {
  time: string // ISO8601 datetime
  availableAttendees: string[] // Email addresses of attendees available at this time
  allAvailable: boolean // True if all required attendees are available
}

/**
 * Find time slots where all (required) attendees are available
 *
 * @param params Collective booking parameters
 * @returns Array of slots with availability information
 */
export async function findCollectiveSlots(
  params: CollectiveBookingParams
): Promise<CollectiveSlot[]> {
  const { attendees, startDate, endDate, preferredTimes } = params

  if (attendees.length < 2) {
    throw new Error('Collective booking requires at least 2 attendees')
  }

  const requiredAttendees = attendees.filter(a => a.required)
  if (requiredAttendees.length === 0) {
    throw new Error('At least one attendee must be marked as required')
  }

  // Fetch availability for each attendee
  const attendeeAvailability = new Map<string, Set<string>>()

  for (const attendee of attendees) {
    const slots = new Set<string>()

    try {
      // Get availability for date range
      let currentDate = new Date(startDate)
      const searchEndDate = new Date(endDate)

      while (currentDate <= searchEndDate) {
        const dateStr = currentDate.toISOString().split('T')[0]

        try {
          const availability = await calcomClient.getAvailability(
            attendee.eventTypeId,
            dateStr
          )

          availability.forEach(slot => slots.add(slot.time))
        } catch (error: any) {
          console.error(
            `Error getting availability for ${attendee.email} on ${dateStr}:`,
            error.message
          )
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1)

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    } catch (error: any) {
      console.error(`Error fetching availability for ${attendee.email}:`, error.message)
    }

    attendeeAvailability.set(attendee.email, slots)
  }

  // Find overlapping slots
  const allSlots = new Set<string>()
  attendeeAvailability.forEach(slots => {
    slots.forEach(slot => allSlots.add(slot))
  })

  const collectiveSlots: CollectiveSlot[] = []

  for (const slot of Array.from(allSlots)) {
    const availableAttendees: string[] = []

    // Check which attendees are available at this time
    attendees.forEach(attendee => {
      const hasSlot = attendeeAvailability.get(attendee.email)?.has(slot)
      if (hasSlot) {
        availableAttendees.push(attendee.email)
      }
    })

    // Check if all required attendees are available
    const allRequiredAvailable = requiredAttendees.every(attendee =>
      availableAttendees.includes(attendee.email)
    )

    // Only include slots where all required attendees are available
    if (allRequiredAvailable) {
      collectiveSlots.push({
        time: slot,
        availableAttendees,
        allAvailable: availableAttendees.length === attendees.length,
      })
    }
  }

  // Sort by time
  collectiveSlots.sort((a, b) => a.time.localeCompare(b.time))

  // If preferred times specified, prioritize those
  if (preferredTimes && preferredTimes.length > 0) {
    collectiveSlots.sort((a, b) => {
      const aTime = a.time.split('T')[1].substring(0, 5) // HH:MM
      const bTime = b.time.split('T')[1].substring(0, 5)

      const aPreferred = preferredTimes.includes(aTime) ? 0 : 1
      const bPreferred = preferredTimes.includes(bTime) ? 0 : 1

      return aPreferred - bPreferred
    })
  }

  return collectiveSlots
}

/**
 * F0293: Create collective booking
 *
 * Books a meeting at the specified time with all attendees.
 * Uses the first attendee's event type as the primary booking.
 *
 * @param primaryEventTypeId Event type to use for the booking
 * @param slot Selected time slot
 * @param attendees All attendees to include
 * @param organizerName Name of person organizing the meeting
 * @param notes Optional meeting notes
 * @returns Created booking
 */
export async function createCollectiveBooking(
  primaryEventTypeId: number,
  slot: string,
  attendees: CollectiveAttendee[],
  organizerName: string,
  organizerEmail: string,
  notes?: string
): Promise<CalComBooking> {
  if (attendees.length < 2) {
    throw new Error('Collective booking requires at least 2 attendees')
  }

  // Build attendee list for notes
  const attendeeList = attendees.map(a => `${a.name} (${a.email})`).join(', ')

  const bookingNotes = [
    `Collective meeting with: ${attendeeList}`,
    notes || '',
  ]
    .filter(Boolean)
    .join('\n\n')

  // Create the primary booking
  const booking = await calcomClient.createBooking({
    eventTypeId: primaryEventTypeId,
    start: slot,
    name: organizerName,
    email: organizerEmail,
    notes: bookingNotes,
    metadata: {
      booking_type: 'collective',
      attendee_count: attendees.length,
      attendee_emails: attendees.map(a => a.email),
    },
  })

  console.log(
    `✓ Collective booking created for ${attendees.length} attendees at ${slot}`
  )

  return booking
}

/**
 * Get best collective slot
 * Returns the first slot where all required attendees are available,
 * preferring slots where all (optional + required) are available
 *
 * @param slots Available collective slots
 * @returns Best slot or undefined if none found
 */
export function getBestCollectiveSlot(
  slots: CollectiveSlot[]
): CollectiveSlot | undefined {
  if (slots.length === 0) {
    return undefined
  }

  // Prefer slots where everyone is available
  const allAvailableSlot = slots.find(s => s.allAvailable)
  if (allAvailableSlot) {
    return allAvailableSlot
  }

  // Otherwise return first slot (all required are available)
  return slots[0]
}

/**
 * Check if specific time works for all attendees
 *
 * @param attendees Attendees to check
 * @param dateTime ISO8601 datetime to check
 * @returns True if all required attendees are available
 */
export async function checkCollectiveAvailability(
  attendees: CollectiveAttendee[],
  dateTime: string
): Promise<{
  available: boolean
  availableAttendees: string[]
  unavailableAttendees: string[]
}> {
  const dateStr = dateTime.split('T')[0]
  const availableAttendees: string[] = []
  const unavailableAttendees: string[] = []

  for (const attendee of attendees) {
    try {
      const slots = await calcomClient.getAvailability(attendee.eventTypeId, dateStr)
      const hasSlot = slots.some(slot => slot.time === dateTime)

      if (hasSlot) {
        availableAttendees.push(attendee.email)
      } else {
        unavailableAttendees.push(attendee.email)
      }
    } catch (error: any) {
      console.error(`Error checking availability for ${attendee.email}:`, error.message)
      unavailableAttendees.push(attendee.email)
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Check if all required attendees are available
  const requiredAttendees = attendees.filter(a => a.required)
  const allRequiredAvailable = requiredAttendees.every(a =>
    availableAttendees.includes(a.email)
  )

  return {
    available: allRequiredAvailable,
    availableAttendees,
    unavailableAttendees,
  }
}
