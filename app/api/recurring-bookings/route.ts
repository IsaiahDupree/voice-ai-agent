// F0320: Recurring booking API endpoint

import { NextRequest, NextResponse } from 'next/server'
import {
  createRecurringBooking,
  cancelRecurringSeries,
  findRecurringSlots,
  type RecurringBookingParams,
  type RecurrenceFrequency,
} from '@/lib/recurring-bookings'
import { apiResponse } from '@/lib/api-response'

/**
 * POST /api/recurring-bookings
 * Create a recurring booking series
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const params: RecurringBookingParams = {
      eventTypeId: body.eventTypeId,
      firstOccurrence: body.firstOccurrence,
      frequency: body.frequency as RecurrenceFrequency,
      count: body.count,
      name: body.name,
      email: body.email,
      phone: body.phone,
      notes: body.notes,
      timeZone: body.timeZone,
      skipWeekends: body.skipWeekends ?? false,
      metadata: body.metadata,
      contactId: body.contactId,
      callId: body.callId,
    }

    // Validation
    if (!params.eventTypeId || !params.firstOccurrence || !params.frequency || !params.count) {
      return apiResponse.error('Missing required fields: eventTypeId, firstOccurrence, frequency, count', 400)
    }

    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(params.frequency)) {
      return apiResponse.error('Invalid frequency. Must be: daily, weekly, biweekly, or monthly', 400)
    }

    if (params.count < 1 || params.count > 52) {
      return apiResponse.error('Count must be between 1 and 52', 400)
    }

    const result = await createRecurringBooking(params)

    if (!result.success) {
      return apiResponse.error('Failed to create any bookings', 500, {
        errors: result.errors,
      })
    }

    return apiResponse.success({
      message: `Created ${result.bookings.length} of ${params.count} requested bookings`,
      bookings: result.bookings,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error: any) {
    console.error('Error creating recurring booking:', error)
    return apiResponse.error(error.message || 'Failed to create recurring booking', 500)
  }
}

/**
 * DELETE /api/recurring-bookings
 * Cancel a recurring booking series
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { bookingIds, reason } = body

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
      return apiResponse.error('bookingIds array is required', 400)
    }

    const result = await cancelRecurringSeries(bookingIds, reason)

    return apiResponse.success({
      message: `Cancelled ${result.cancelled} of ${bookingIds.length} bookings`,
      cancelled: result.cancelled,
      errors: result.errors.length > 0 ? result.errors : undefined,
    })
  } catch (error: any) {
    console.error('Error cancelling recurring series:', error)
    return apiResponse.error(error.message || 'Failed to cancel series', 500)
  }
}

/**
 * GET /api/recurring-bookings/find-slots
 * Find available slots for recurring pattern
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const eventTypeId = parseInt(searchParams.get('eventTypeId') || '')
    const startDate = searchParams.get('startDate') || ''
    const frequency = searchParams.get('frequency') as RecurrenceFrequency
    const count = parseInt(searchParams.get('count') || '4')
    const skipWeekends = searchParams.get('skipWeekends') === 'true'

    if (!eventTypeId || !startDate || !frequency) {
      return apiResponse.error('Missing required parameters: eventTypeId, startDate, frequency', 400)
    }

    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(frequency)) {
      return apiResponse.error('Invalid frequency', 400)
    }

    const slots = await findRecurringSlots(eventTypeId, startDate, frequency, count, skipWeekends)

    return apiResponse.success({
      slots,
      frequency,
      count: slots.length,
    })
  } catch (error: any) {
    console.error('Error finding recurring slots:', error)
    return apiResponse.error(error.message || 'Failed to find slots', 500)
  }
}
