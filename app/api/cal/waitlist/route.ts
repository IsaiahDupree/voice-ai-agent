import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0344: POST /api/cal/waitlist - Add contact to waitlist if no slots available
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      eventTypeId,
      contactName,
      contactEmail,
      contactPhone,
      preferredDate,
      notes,
      callId,
    } = body

    if (!eventTypeId || !contactEmail) {
      return NextResponse.json(
        { error: 'eventTypeId and contactEmail are required' },
        { status: 400 }
      )
    }

    // Add contact to waitlist
    const { data: waitlistEntry, error: waitlistError } = await supabaseAdmin
      .from('calcom_waitlist')
      .insert({
        event_type_id: String(eventTypeId),
        contact_name: contactName,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        preferred_date: preferredDate || null,
        notes: notes || null,
        call_id: callId || null,
        status: 'waiting',
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (waitlistError) {
      throw waitlistError
    }

    return NextResponse.json({
      success: true,
      message: `${contactName || 'Contact'} added to waitlist`,
      waitlist_entry: {
        id: waitlistEntry.id,
        position: waitlistEntry.created_at, // Could be replaced with actual position query
        email: contactEmail,
        status: waitlistEntry.status,
        created_at: waitlistEntry.created_at,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error adding to waitlist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add contact to waitlist' },
      { status: 500 }
    )
  }
}

// F0344: GET /api/cal/waitlist - Get waitlist for an event type
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventTypeId = searchParams.get('eventTypeId')

    if (!eventTypeId) {
      return NextResponse.json(
        { error: 'eventTypeId is required' },
        { status: 400 }
      )
    }

    // Get waitlist for this event type
    const { data: waitlist, error: waitlistError } = await supabaseAdmin
      .from('calcom_waitlist')
      .select('*')
      .eq('event_type_id', String(eventTypeId))
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })

    if (waitlistError) {
      throw waitlistError
    }

    return NextResponse.json({
      success: true,
      eventTypeId: parseInt(eventTypeId),
      waitlist_count: waitlist?.length || 0,
      waitlist: waitlist || [],
    })
  } catch (error: any) {
    console.error('Error fetching waitlist:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch waitlist' },
      { status: 500 }
    )
  }
}
