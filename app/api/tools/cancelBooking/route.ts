// F0428: cancelBooking tool - Cancel existing booking

import { NextRequest, NextResponse } from 'next/server'
import { calcomClient } from '@/lib/calcom'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { bookingId, reason, callId } = body

    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      )
    }

    // F0428: Cancel booking via Cal.com
    await calcomClient.cancelBooking(bookingId, reason)

    // Update our database record
    const { error: dbError } = await supabaseAdmin
      .from('voice_agent_bookings')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('booking_id', bookingId)

    if (dbError) {
      console.error('Error updating booking status in database:', dbError)
    }

    // Log tool invocation if callId provided
    if (callId) {
      await supabaseAdmin.from('voice_agent_function_calls').insert({
        call_id: callId,
        function_name: 'cancelBooking',
        parameters: { bookingId, reason },
        result: { success: true },
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Booking cancelled successfully',
      bookingId,
    })
  } catch (error: any) {
    console.error('Error cancelling booking:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel booking' },
      { status: 500 }
    )
  }
}
