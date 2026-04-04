// F0320: Recurring booking - book recurring appointment series

import { calcomClient, type BookingParams, type CalComBooking } from './calcom'

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export interface RecurringBookingParams extends Omit<BookingParams, 'start'> {
  firstOccurrence: string // ISO8601 datetime for first appointment
  frequency: RecurrenceFrequency
  count: number // Number of occurrences (max 52 for safety)
  skipWeekends?: boolean // Skip Saturday/Sunday for weekly/biweekly
}

export interface RecurringBookingResult {
  success: boolean
  bookings: CalComBooking[]
  errors: Array<{
    occurrence: number
    date: string
    error: string
  }>
}

/**
 * Calculate next occurrence date based on frequency
 */
function getNextOccurrence(
  currentDate: Date,
  frequency: RecurrenceFrequency
): Date {
  const next = new Date(currentDate)

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'biweekly':
      next.setDate(next.getDate() + 14)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
  }

  return next
}

/**
 * Check if date is weekend
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay()
  return day === 0 || day === 6 // Sunday or Saturday
}

/**
 * F0320: Create recurring booking series
 *
 * Creates multiple bookings based on recurrence pattern.
 * Continues even if some bookings fail, returns all results.
 *
 * @param params Recurring booking parameters
 * @returns Result with successful bookings and any errors
 */
export async function createRecurringBooking(
  params: RecurringBookingParams
): Promise<RecurringBookingResult> {
  const {
    firstOccurrence,
    frequency,
    count,
    skipWeekends = false,
    ...bookingParams
  } = params

  // Validation
  if (count < 1) {
    throw new Error('Count must be at least 1')
  }

  if (count > 52) {
    throw new Error('Maximum 52 occurrences allowed for safety')
  }

  const bookings: CalComBooking[] = []
  const errors: Array<{ occurrence: number; date: string; error: string }> = []

  let currentDate = new Date(firstOccurrence)
  let occurrence = 0
  let successfulBookings = 0

  // Generate occurrence dates
  while (successfulBookings < count && occurrence < count * 3) {
    // Safety: stop if we try too many iterations
    occurrence++

    // Skip weekends if requested
    if (skipWeekends && isWeekend(currentDate)) {
      currentDate = getNextOccurrence(currentDate, frequency)
      continue
    }

    try {
      // Create booking for this occurrence
      const booking = await calcomClient.createBooking({
        ...bookingParams,
        start: currentDate.toISOString(),
      })

      bookings.push(booking)
      successfulBookings++

      console.log(
        `✓ Recurring booking ${successfulBookings}/${count} created: ${currentDate.toISOString()}`
      )

      // Add small delay between bookings to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error: any) {
      console.error(
        `✗ Failed to create occurrence ${occurrence} at ${currentDate.toISOString()}:`,
        error.message
      )

      errors.push({
        occurrence,
        date: currentDate.toISOString(),
        error: error.message,
      })

      // If it's a conflict, that's expected - continue
      // If it's a different error, we might want to continue anyway
    }

    // Move to next occurrence
    currentDate = getNextOccurrence(currentDate, frequency)
  }

  return {
    success: bookings.length > 0,
    bookings,
    errors,
  }
}

/**
 * Cancel all bookings in a recurring series
 *
 * @param bookingIds Array of booking UIDs to cancel
 * @param reason Cancellation reason
 */
export async function cancelRecurringSeries(
  bookingIds: string[],
  reason?: string
): Promise<{
  cancelled: number
  errors: Array<{ bookingId: string; error: string }>
}> {
  let cancelled = 0
  const errors: Array<{ bookingId: string; error: string }> = []

  for (const bookingId of bookingIds) {
    try {
      await calcomClient.cancelBooking(bookingId, reason)
      cancelled++
    } catch (error: any) {
      errors.push({
        bookingId,
        error: error.message,
      })
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  return { cancelled, errors }
}

/**
 * Get available slots for recurring pattern
 * Returns first N available dates that match the recurrence pattern
 *
 * @param eventTypeId Cal.com event type ID
 * @param startDate Starting date to search from
 * @param frequency Recurrence frequency
 * @param count Number of slots needed
 * @param skipWeekends Skip weekend dates
 */
export async function findRecurringSlots(
  eventTypeId: number,
  startDate: string,
  frequency: RecurrenceFrequency,
  count: number,
  skipWeekends: boolean = false
): Promise<string[]> {
  const availableSlots: string[] = []
  let currentDate = new Date(startDate)
  let attempts = 0
  const maxAttempts = count * 10 // Search up to 10x the requested count

  while (availableSlots.length < count && attempts < maxAttempts) {
    attempts++

    // Skip weekends if requested
    if (skipWeekends && isWeekend(currentDate)) {
      currentDate = getNextOccurrence(currentDate, frequency)
      continue
    }

    try {
      // Check if this date has availability
      const dateStr = currentDate.toISOString().split('T')[0]
      const slots = await calcomClient.getAvailability(eventTypeId, dateStr)

      if (slots.length > 0) {
        // Use the first available slot on this date
        availableSlots.push(slots[0].time)
      }
    } catch (error: any) {
      console.error(`Error checking availability for ${currentDate}:`, error.message)
    }

    // Move to next occurrence
    currentDate = getNextOccurrence(currentDate, frequency)

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  return availableSlots
}
