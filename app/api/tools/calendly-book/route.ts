import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const CALENDLY_API_KEY = process.env.CALENDLY_API_KEY
const CALENDLY_EVENT_TYPE_URI = process.env.CALENDLY_EVENT_TYPE_URI

export async function POST(request: NextRequest) {
  try {
    if (!CALENDLY_API_KEY || !CALENDLY_EVENT_TYPE_URI) {
      return NextResponse.json(
        { error: 'Calendly not configured' },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { datetime, name, email, phone, businessId, campaignId, notes } = body

    if (!datetime || !name || !email) {
      return NextResponse.json(
        { error: 'datetime, name, and email are required' },
        { status: 400 }
      )
    }

    // Schedule the invitee via Calendly's scheduling API
    const res = await fetch('https://api.calendly.com/scheduled_events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CALENDLY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        event_type: CALENDLY_EVENT_TYPE_URI,
        start_time: datetime,
        invitee: {
          name,
          email,
          questions_and_answers: [
            ...(phone ? [{ question: 'Phone', answer: phone }] : []),
            ...(notes ? [{ question: 'Notes', answer: notes }] : []),
          ],
        },
      }),
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(
        `Calendly booking error: ${res.status} ${errData.message || res.statusText}`
      )
    }

    const booking = await res.json()

    // Log the booking in Supabase
    await supabaseAdmin.from('localreach_bookings').insert({
      business_id: businessId || null,
      campaign_id: campaignId || null,
      calendly_event_uri: booking.resource?.uri || null,
      invitee_name: name,
      invitee_email: email,
      invitee_phone: phone || null,
      scheduled_at: datetime,
      status: 'confirmed',
      notes: notes || null,
      created_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      booking: {
        eventUri: booking.resource?.uri,
        scheduledAt: datetime,
        invitee: { name, email },
        status: 'confirmed',
      },
    })
  } catch (error: any) {
    console.error('[Calendly Book API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to book appointment' },
      { status: 500 }
    )
  }
}
