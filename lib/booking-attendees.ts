// F0307: Booking attendee count - support multi-person bookings

import { supabaseAdmin } from '@/lib/supabase'

export interface AttendeeData {
  name: string
  email?: string
  phone?: string
  role?: 'primary' | 'secondary'
}

/**
 * F0307: Create booking with multiple attendees
 */
export async function createBookingWithAttendees(data: {
  booking_id: string
  primary_contact_id: string
  attendees: AttendeeData[]
  max_attendees?: number
}): Promise<{
  booking_id: string
  attendee_count: number
  attendee_ids: string[]
}> {
  const supabase = supabaseAdmin
  const { booking_id, attendees, max_attendees = 10 } = data

  if (attendees.length > max_attendees) {
    throw new Error(`Maximum ${max_attendees} attendees allowed`)
  }

  const attendeeIds: string[] = []

  // Insert each attendee
  for (const attendee of attendees) {
    const { data: record, error } = await supabase
      .from('booking_attendees')
      .insert({
        booking_id,
        name: attendee.name,
        email: attendee.email,
        phone: attendee.phone,
        role: attendee.role || 'secondary',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to add attendee:', error)
      continue
    }

    attendeeIds.push(record.id)
  }

  // Update booking with attendee count
  await supabase
    .from('bookings')
    .update({ attendee_count: attendees.length })
    .eq('id', booking_id)

  return {
    booking_id,
    attendee_count: attendees.length,
    attendee_ids: attendeeIds,
  }
}

/**
 * F0307: Get attendees for a booking
 */
export async function getBookingAttendees(bookingId: string): Promise<AttendeeData[]> {
  const supabase = supabaseAdmin

  const { data: attendees, error } = await supabase
    .from('booking_attendees')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch attendees: ${error.message}`)
  }

  return (attendees || []).map((a) => ({
    name: a.name,
    email: a.email,
    phone: a.phone,
    role: a.role,
  }))
}

/**
 * F0307: Add attendee to existing booking
 */
export async function addAttendee(
  bookingId: string,
  attendee: AttendeeData
): Promise<{ success: boolean; attendee_id: string }> {
  const supabase = supabaseAdmin

  // Check current attendee count
  const { data: booking } = await supabase
    .from('bookings')
    .select('attendee_count')
    .eq('id', bookingId)
    .single()

  const currentCount = booking?.attendee_count || 0
  const maxAttendees = 10

  if (currentCount >= maxAttendees) {
    throw new Error(`Maximum ${maxAttendees} attendees reached`)
  }

  // Add attendee
  const { data: record, error } = await supabase
    .from('booking_attendees')
    .insert({
      booking_id: bookingId,
      name: attendee.name,
      email: attendee.email,
      phone: attendee.phone,
      role: attendee.role || 'secondary',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to add attendee: ${error.message}`)
  }

  // Update attendee count
  await supabase
    .from('bookings')
    .update({ attendee_count: currentCount + 1 })
    .eq('id', bookingId)

  return {
    success: true,
    attendee_id: record.id,
  }
}

/**
 * F0307: Remove attendee from booking
 */
export async function removeAttendee(bookingId: string, attendeeId: string): Promise<boolean> {
  const supabase = supabaseAdmin

  const { error } = await supabase
    .from('booking_attendees')
    .delete()
    .eq('id', attendeeId)
    .eq('booking_id', bookingId)

  if (error) {
    throw new Error(`Failed to remove attendee: ${error.message}`)
  }

  // Update attendee count
  const { data: booking } = await supabase
    .from('bookings')
    .select('attendee_count')
    .eq('id', bookingId)
    .single()

  const newCount = Math.max(0, (booking?.attendee_count || 1) - 1)

  await supabase
    .from('bookings')
    .update({ attendee_count: newCount })
    .eq('id', bookingId)

  return true
}
