// F0293: Collective booking API endpoint

import { NextRequest, NextResponse } from 'next/server'
import {
  findCollectiveSlots,
  createCollectiveBooking,
  checkCollectiveAvailability,
  getBestCollectiveSlot,
  type CollectiveBookingParams,
  type CollectiveAttendee,
} from '@/lib/collective-booking'
import { apiResponse } from '@/lib/api-response'

/**
 * POST /api/collective-booking/find-slots
 * Find time slots where all required attendees are available
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const params: CollectiveBookingParams = {
      attendees: body.attendees,
      duration: body.duration || 30,
      startDate: body.startDate,
      endDate: body.endDate,
      preferredTimes: body.preferredTimes,
      timeZone: body.timeZone,
    }

    // Validation
    if (!params.attendees || params.attendees.length < 2) {
      return apiResponse.error('At least 2 attendees are required', 400)
    }

    if (!params.startDate || !params.endDate) {
      return apiResponse.error('startDate and endDate are required', 400)
    }

    const requiredCount = params.attendees.filter((a: CollectiveAttendee) => a.required).length
    if (requiredCount === 0) {
      return apiResponse.error('At least one attendee must be marked as required', 400)
    }

    const slots = await findCollectiveSlots(params)
    const bestSlot = getBestCollectiveSlot(slots)

    return apiResponse.success({
      slots,
      bestSlot,
      totalSlots: slots.length,
      attendeeCount: params.attendees.length,
    })
  } catch (error: any) {
    console.error('Error finding collective slots:', error)
    return apiResponse.error(error.message || 'Failed to find slots', 500)
  }
}

/**
 * PUT /api/collective-booking
 * Create a collective booking at specified time
 */
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      primaryEventTypeId,
      slot,
      attendees,
      organizerName,
      organizerEmail,
      notes,
    } = body

    // Validation
    if (!primaryEventTypeId || !slot || !attendees || !organizerName || !organizerEmail) {
      return apiResponse.error(
        'Missing required fields: primaryEventTypeId, slot, attendees, organizerName, organizerEmail',
        400
      )
    }

    if (!Array.isArray(attendees) || attendees.length < 2) {
      return apiResponse.error('At least 2 attendees are required', 400)
    }

    const booking = await createCollectiveBooking(
      primaryEventTypeId,
      slot,
      attendees,
      organizerName,
      organizerEmail,
      notes
    )

    return apiResponse.success({
      booking,
      attendeeCount: attendees.length,
    })
  } catch (error: any) {
    console.error('Error creating collective booking:', error)
    return apiResponse.error(error.message || 'Failed to create booking', 500)
  }
}

/**
 * GET /api/collective-booking/check
 * Check if specific time works for all attendees
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dateTime = searchParams.get('dateTime')
    const attendeesParam = searchParams.get('attendees')

    if (!dateTime || !attendeesParam) {
      return apiResponse.error('dateTime and attendees parameters are required', 400)
    }

    let attendees: CollectiveAttendee[]
    try {
      attendees = JSON.parse(attendeesParam)
    } catch {
      return apiResponse.error('Invalid attendees JSON', 400)
    }

    if (!Array.isArray(attendees) || attendees.length < 2) {
      return apiResponse.error('At least 2 attendees are required', 400)
    }

    const result = await checkCollectiveAvailability(attendees, dateTime)

    return apiResponse.success(result)
  } catch (error: any) {
    console.error('Error checking collective availability:', error)
    return apiResponse.error(error.message || 'Failed to check availability', 500)
  }
}
