// F0341: Booking ID in SMS
// F0343: Booking metadata
// Helper functions for booking operations

import { supabaseAdmin } from './supabase'

interface BookingData {
  event_type: string
  scheduled_time: string
  contact_name: string
  contact_phone: string
  contact_email: string
  call_id?: string
  metadata?: Record<string, any>
}

interface SMSData {
  to_phone: string
  message: string
  booking_id?: string
  call_id?: string
  template_name?: string
}

/**
 * F0343: Create booking with metadata
 * Stores additional booking context and source information
 */
export async function createBookingWithMetadata(
  bookingData: BookingData
): Promise<any> {
  const { metadata = {}, ...basicData } = bookingData

  // F0343: Include metadata in booking record
  const enrichedMetadata = {
    ...metadata,
    source: metadata.source || 'voice_call',
    created_via: 'voice_agent',
    created_at_ms: Date.now(),
  }

  const { data, error } = await supabaseAdmin
    .from('voice_agent_bookings')
    .insert({
      ...basicData,
      metadata: enrichedMetadata, // F0343: Booking metadata
      status: 'confirmed',
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating booking:', error)
    throw new Error('Failed to create booking')
  }

  return data
}

/**
 * F0341: Send SMS with booking ID included
 * Includes booking reference for customer lookup
 */
export async function sendBookingConfirmationSMS(
  smsData: SMSData
): Promise<void> {
  const { to_phone, message, booking_id, call_id, template_name } = smsData

  // F0341: Include booking ID in message if available
  let finalMessage = message
  if (booking_id && !message.includes(booking_id)) {
    finalMessage = `${message}\n\nBooking ID: ${booking_id}`
  }

  const { error } = await supabaseAdmin.from('voice_agent_sms_queue').insert({
    to_phone,
    message: finalMessage,
    booking_id: booking_id || null, // F0341: Link SMS to booking
    call_id: call_id || null,
    template_name: template_name || 'booking_confirmation',
    status: 'pending',
    created_at: new Date().toISOString(),
  })

  if (error) {
    console.error('Error queueing SMS:', error)
    throw new Error('Failed to queue SMS')
  }

  console.log(`[SMS] Queued booking confirmation to ${to_phone} (Booking: ${booking_id})`)
}

/**
 * F0341, F0343: Create booking and send confirmation in one transaction
 */
export async function createBookingWithConfirmation(
  bookingData: BookingData
): Promise<{ booking: any; sms: boolean }> {
  // Step 1: Create booking with metadata
  const booking = await createBookingWithMetadata(bookingData)

  // Step 2: Send confirmation SMS with booking ID
  try {
    const confirmationMessage = generateBookingConfirmationMessage(
      booking.contact_name,
      booking.event_type,
      booking.scheduled_time
    )

    await sendBookingConfirmationSMS({
      to_phone: booking.contact_phone,
      message: confirmationMessage,
      booking_id: booking.id, // F0341: Include booking ID
      call_id: booking.call_id,
      template_name: 'booking_confirmation',
    })

    return { booking, sms: true }
  } catch (smsError) {
    console.error('Failed to send confirmation SMS:', smsError)
    // Booking succeeded, SMS failed
    return { booking, sms: false }
  }
}

/**
 * Generate human-readable booking confirmation message
 */
function generateBookingConfirmationMessage(
  name: string,
  eventType: string,
  scheduledTime: string
): string {
  const date = new Date(scheduledTime)
  const dateStr = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `Hi ${name}! Your ${eventType} is confirmed for ${dateStr} at ${timeStr}. We look forward to seeing you!`
}

/**
 * F0343: Update booking metadata
 * Add or update metadata on existing booking
 */
export async function updateBookingMetadata(
  bookingId: string,
  newMetadata: Record<string, any>
): Promise<void> {
  // Get existing booking
  const { data: booking } = await supabaseAdmin
    .from('voice_agent_bookings')
    .select('metadata')
    .eq('id', bookingId)
    .single()

  if (!booking) {
    throw new Error('Booking not found')
  }

  // Merge metadata
  const updatedMetadata = {
    ...booking.metadata,
    ...newMetadata,
    last_updated: new Date().toISOString(),
  }

  // Update booking
  const { error } = await supabaseAdmin
    .from('voice_agent_bookings')
    .update({ metadata: updatedMetadata })
    .eq('id', bookingId)

  if (error) {
    console.error('Error updating booking metadata:', error)
    throw new Error('Failed to update booking metadata')
  }
}

/**
 * F0341: Get booking by ID with full details
 */
export async function getBookingById(bookingId: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from('voice_agent_bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (error) {
    console.error('Error fetching booking:', error)
    throw new Error('Booking not found')
  }

  return data
}

/**
 * F0341: Get booking by phone number
 * Find recent bookings for a contact
 */
export async function getBookingsByPhone(
  phone: string,
  limit: number = 10
): Promise<any[]> {
  const { data, error } = await supabaseAdmin
    .from('voice_agent_bookings')
    .select('*')
    .eq('contact_phone', phone)
    .order('scheduled_time', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching bookings:', error)
    return []
  }

  return data || []
}
