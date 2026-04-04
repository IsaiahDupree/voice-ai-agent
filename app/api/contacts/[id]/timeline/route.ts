// F0587, F0588, F0589, F0590: Contact timeline API
// Returns combined history of calls, SMS, and bookings

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface TimelineEvent {
  type: 'call' | 'sms' | 'booking' | 'note'
  timestamp: string
  data: any
  id?: string
}

/**
 * F0587: GET /api/contacts/[id]/timeline
 * Returns combined timeline of all contact interactions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const contactId = parseInt(id)

    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid contact ID' },
        { status: 400 }
      )
    }

    // Get contact to fetch phone number
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('phone, email, notes')
      .eq('id', contactId)
      .single()

    if (contactError) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    const timeline: TimelineEvent[] = []

    // F0588: Get all calls for this contact
    if (contact.phone) {
      const { data: calls } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('*')
        .eq('customer_phone', contact.phone)
        .order('created_at', { ascending: false })

      if (calls) {
        calls.forEach((call) => {
          timeline.push({
            type: 'call',
            timestamp: call.created_at,
            id: call.id,
            data: {
              direction: call.direction || 'unknown',
              status: call.status,
              duration: call.duration,
              cost: call.cost,
            },
          })
        })
      }
    }

    // F0589: Get all SMS for this contact
    if (contact.phone) {
      const { data: smsList } = await supabaseAdmin
        .from('voice_agent_sms_logs')
        .select('*')
        .or(`to_number.eq.${contact.phone},from_number.eq.${contact.phone}`)
        .order('created_at', { ascending: false })

      if (smsList) {
        smsList.forEach((sms) => {
          timeline.push({
            type: 'sms',
            timestamp: sms.created_at,
            id: sms.message_sid,
            data: {
              direction: sms.direction || 'unknown',
              body: sms.body,
              status: sms.status,
              to: sms.to_number,
              from: sms.from_number,
            },
          })
        })
      }
    }

    // F0590: Get all bookings for this contact
    const { data: bookings } = await supabaseAdmin
      .from('voice_agent_bookings')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })

    if (bookings) {
      bookings.forEach((booking) => {
        timeline.push({
          type: 'booking',
          timestamp: booking.created_at,
          id: booking.id,
          data: {
            event_type: booking.event_type,
            start_time: booking.start_time,
            end_time: booking.end_time,
            status: booking.status,
            confirmed: booking.confirmed,
            cancelled: booking.cancelled,
          },
        })
      })
    }

    // Add notes as timeline events
    if (Array.isArray(contact.notes)) {
      contact.notes.forEach((note: any) => {
        timeline.push({
          type: 'note',
          timestamp: note.created_at,
          data: {
            content: note.content,
            source: note.source,
          },
        })
      })
    }

    // Sort timeline by timestamp (most recent first)
    timeline.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    return NextResponse.json({
      contactId,
      timeline,
      stats: {
        totalCalls: timeline.filter((e) => e.type === 'call').length,
        totalSMS: timeline.filter((e) => e.type === 'sms').length,
        totalBookings: timeline.filter((e) => e.type === 'booking').length,
        totalNotes: timeline.filter((e) => e.type === 'note').length,
      },
    })
  } catch (error: any) {
    console.error('[Contact Timeline] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch timeline' },
      { status: 500 }
    )
  }
}
