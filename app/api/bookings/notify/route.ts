// F0323: POST /api/bookings/notify - Send booking created notification email
// Called automatically when a booking is created

import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, formatBookingNotification } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const booking = await request.json()

    // Validate required fields
    if (!booking.contactName || !booking.contactPhone || !booking.eventType || !booking.startTime || !booking.endTime) {
      return NextResponse.json(
        { error: 'Missing required booking fields: contactName, contactPhone, eventType, startTime, endTime' },
        { status: 400 }
      )
    }

    const recipient = booking.notifyEmail || process.env.ADMIN_EMAIL

    if (!recipient) {
      console.warn('⚠️ No notification email configured - skipping booking notification')
      return NextResponse.json({
        success: true,
        message: 'Booking notification skipped (no recipient)',
      })
    }

    // Format and send notification email
    const html = formatBookingNotification({
      contactName: booking.contactName,
      contactPhone: booking.contactPhone,
      eventType: booking.eventType,
      startTime: booking.startTime,
      endTime: booking.endTime,
      calendarLink: booking.calendarLink,
      notes: booking.notes,
    })

    const result = await sendEmail({
      to: recipient,
      subject: `✅ New Booking: ${booking.contactName} - ${booking.eventType}`,
      html,
    })

    if (!result.success) {
      console.error('Failed to send booking notification:', result.error)
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Booking notification sent',
      recipient,
      bookingDetails: {
        contactName: booking.contactName,
        eventType: booking.eventType,
        startTime: booking.startTime,
      },
    })
  } catch (error: any) {
    console.error('Error sending booking notification:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
