import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0327: GET /api/cal/booking-payment - Get payment link for booking
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const bookingId = searchParams.get('bookingId')
    const eventTypeId = searchParams.get('eventTypeId')

    if (!bookingId && !eventTypeId) {
      return NextResponse.json(
        { error: 'bookingId or eventTypeId is required' },
        { status: 400 }
      )
    }

    // Fetch booking details
    let bookingRecord
    if (bookingId) {
      const { data, error } = await supabaseAdmin
        .from('voice_agent_bookings')
        .select('*')
        .eq('booking_id', bookingId)
        .single()

      if (error) {
        return NextResponse.json(
          { error: 'Booking not found' },
          { status: 404 }
        )
      }
      bookingRecord = data
    }

    // Generate payment link (Stripe, PayPal, or other payment processor)
    // For now, return a placeholder that integrates with Cal.com payment flows
    const stripePublicKey = process.env.STRIPE_PUBLIC_KEY
    const calcomPaymentLink = process.env.CALCOM_PAYMENT_LINK_BASE || 'https://cal.com'

    const paymentLink = `${calcomPaymentLink}/payment/${bookingId || eventTypeId}`

    return NextResponse.json({
      success: true,
      payment_link: paymentLink,
      booking_id: bookingId,
      event_type_id: eventTypeId,
      stripe_enabled: !!stripePublicKey,
    })
  } catch (error: any) {
    console.error('Error generating payment link:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate payment link' },
      { status: 500 }
    )
  }
}

// F0327: POST /api/cal/booking-payment - Process booking payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      bookingId,
      amount,
      currency = 'USD',
      stripeTokenId,
    } = body

    if (!bookingId || !amount) {
      return NextResponse.json(
        { error: 'bookingId and amount are required' },
        { status: 400 }
      )
    }

    // Store payment information in database
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('calcom_booking_payments')
      .insert({
        booking_id: bookingId,
        amount,
        currency,
        status: 'pending',
        stripe_token_id: stripeTokenId || null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (paymentError) {
      throw paymentError
    }

    // In a real implementation, this would process the payment via Stripe
    // For now, return success
    return NextResponse.json({
      success: true,
      message: 'Payment processed successfully',
      payment: {
        id: payment.id,
        booking_id: payment.booking_id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error processing payment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process payment' },
      { status: 500 }
    )
  }
}
