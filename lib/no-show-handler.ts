// F0303: No-show handling - detect, mark, and follow up on no-shows

import { supabaseAdmin } from '@/lib/supabase'
import { sendSMS } from '@/lib/sms'

export interface NoShowData {
  booking_id: string
  contact_id: string
  scheduled_time: string
  detected_at?: string
  auto_detected: boolean
}

/**
 * F0303: Mark booking as no-show
 */
export async function markAsNoShow(data: NoShowData): Promise<{
  success: boolean
  no_show_id: string
}> {
  const supabase = supabaseAdmin

  // Update booking status
  const { error: bookingError } = await supabase
    .from('bookings')
    .update({
      status: 'no_show',
      no_show_at: data.detected_at || new Date().toISOString(),
    })
    .eq('id', data.booking_id)

  if (bookingError) {
    throw new Error(`Failed to mark no-show: ${bookingError.message}`)
  }

  // Record no-show
  const { data: noShowRecord, error: noShowError } = await supabase
    .from('booking_no_shows')
    .insert({
      booking_id: data.booking_id,
      contact_id: data.contact_id,
      scheduled_time: data.scheduled_time,
      detected_at: data.detected_at || new Date().toISOString(),
      auto_detected: data.auto_detected,
    })
    .select()
    .single()

  if (noShowError) {
    throw new Error(`Failed to record no-show: ${noShowError.message}`)
  }

  // Update contact no-show count
  const { data: contact } = await supabase
    .from('contacts')
    .select('no_show_count')
    .eq('id', data.contact_id)
    .single()

  await supabase
    .from('contacts')
    .update({
      no_show_count: (contact?.no_show_count || 0) + 1,
      last_no_show_at: new Date().toISOString(),
    })
    .eq('id', data.contact_id)

  return {
    success: true,
    no_show_id: noShowRecord.id,
  }
}

/**
 * F0303: Auto-detect no-shows (run periodically)
 */
export async function detectNoShows(): Promise<{
  detected: number
  bookings: string[]
}> {
  const supabase = supabaseAdmin
  const now = new Date()
  const gracePeriodMinutes = 15 // Consider no-show after 15 min

  const cutoffTime = new Date(now.getTime() - gracePeriodMinutes * 60000)

  // Find bookings that are confirmed but past their time + grace period
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('status', 'confirmed')
    .lt('start_time', cutoffTime.toISOString())

  if (error || !bookings) {
    console.error('Failed to detect no-shows:', error)
    return { detected: 0, bookings: [] }
  }

  const markedBookings: string[] = []

  for (const booking of bookings) {
    try {
      await markAsNoShow({
        booking_id: booking.id,
        contact_id: booking.contact_id,
        scheduled_time: booking.start_time,
        detected_at: new Date().toISOString(),
        auto_detected: true,
      })

      markedBookings.push(booking.id)
    } catch (err) {
      console.error(`Failed to mark booking ${booking.id} as no-show:`, err)
    }
  }

  return {
    detected: markedBookings.length,
    bookings: markedBookings,
  }
}

/**
 * F0303: Send no-show follow-up SMS
 */
export async function sendNoShowFollowUp(bookingId: string, customMessage?: string): Promise<boolean> {
  const supabase = supabaseAdmin

  // Get booking and contact details
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('*, contacts!inner(*)')
    .eq('id', bookingId)
    .single()

  if (error || !booking) {
    throw new Error(`Booking ${bookingId} not found`)
  }

  const contact = booking.contacts

  if (!contact.phone) {
    throw new Error('Contact has no phone number')
  }

  // Default message
  const message =
    customMessage ||
    `Hi ${contact.first_name || ''}, we noticed you missed your appointment on ${new Date(booking.start_time).toLocaleDateString()}. We'd love to reschedule! Reply YES to book a new time.`

  try {
    await sendSMS({
      to: contact.phone,
      body: message,
    })

    // Record follow-up
    await supabase
      .from('booking_no_shows')
      .update({
        followup_sent: true,
        followup_sent_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId)

    return true
  } catch (err) {
    console.error('Failed to send no-show follow-up:', err)
    return false
  }
}

/**
 * F0303: Get no-show statistics
 */
export async function getNoShowStats(startDate?: string, endDate?: string): Promise<{
  total_no_shows: number
  auto_detected: number
  manual_marked: number
  followup_sent: number
  followup_rate: number
  by_contact: Array<{ contact_id: string; count: number }>
}> {
  const supabase = supabaseAdmin

  let query = supabase.from('booking_no_shows').select('*')

  if (startDate) {
    query = query.gte('detected_at', startDate)
  }
  if (endDate) {
    query = query.lte('detected_at', endDate)
  }

  const { data: noShows } = await query

  if (!noShows || noShows.length === 0) {
    return {
      total_no_shows: 0,
      auto_detected: 0,
      manual_marked: 0,
      followup_sent: 0,
      followup_rate: 0,
      by_contact: [],
    }
  }

  const autoDetected = noShows.filter((ns) => ns.auto_detected).length
  const followupSent = noShows.filter((ns) => ns.followup_sent).length

  // Group by contact
  const contactCounts: Record<string, number> = {}
  noShows.forEach((ns) => {
    contactCounts[ns.contact_id] = (contactCounts[ns.contact_id] || 0) + 1
  })

  const byContact = Object.entries(contactCounts)
    .map(([contact_id, count]) => ({ contact_id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    total_no_shows: noShows.length,
    auto_detected: autoDetected,
    manual_marked: noShows.length - autoDetected,
    followup_sent: followupSent,
    followup_rate: (followupSent / noShows.length) * 100,
    by_contact: byContact,
  }
}
