import { NextRequest, NextResponse } from 'next/server'

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

    // Parse optional body for timezone preference
    let timezone = 'America/New_York'
    try {
      const body = await request.json()
      if (body.timezone) timezone = body.timezone
    } catch {
      // No body is fine, use defaults
    }

    // Get available times for the next 7 days
    const startTime = new Date().toISOString()
    const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const url = new URL('https://api.calendly.com/event_type_available_times')
    url.searchParams.set('event_type', CALENDLY_EVENT_TYPE_URI)
    url.searchParams.set('start_time', startTime)
    url.searchParams.set('end_time', endTime)

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${CALENDLY_API_KEY}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(
        `Calendly API error: ${res.status} ${errData.message || res.statusText}`
      )
    }

    const data = await res.json()
    const availableTimes = data.collection || []

    // Return next 3 available slots
    const nextSlots = availableTimes.slice(0, 3).map((slot: any) => {
      const dt = new Date(slot.start_time)
      return {
        startTime: slot.start_time,
        status: slot.status,
        displayTime: dt.toLocaleString('en-US', {
          timeZone: timezone,
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        inviteesRemaining: slot.invitees_remaining,
      }
    })

    return NextResponse.json({
      success: true,
      timezone,
      slots: nextSlots,
    })
  } catch (error: any) {
    console.error('[Calendly Slots API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check available slots' },
      { status: 500 }
    )
  }
}
