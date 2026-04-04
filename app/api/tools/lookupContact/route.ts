// F0959: POST /api/tools/lookupContact - Executes lookupContact tool directly

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F0959: POST /api/tools/lookupContact
 * Looks up contact by phone number or email
 * Used by voice agent to personalize conversation
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, email } = body

    if (!phone && !email) {
      return NextResponse.json(
        { error: 'Either phone or email is required' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .limit(1)

    if (phone) {
      query = query.eq('phone', phone)
    } else if (email) {
      query = query.eq('email', email)
    }

    const { data, error } = await query.maybeSingle()

    if (error) throw error

    // No contact found
    if (!data) {
      return NextResponse.json({
        success: true,
        found: false,
        contact: null,
        message: 'No contact found with that information',
      })
    }

    // Contact found - return formatted data
    const contact = {
      id: data.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      company: data.company,
      deal_stage: data.deal_stage,
      last_contact: data.last_contact,
      call_count: data.call_count || 0,
      booking_count: data.booking_count || 0,
      notes: data.notes,
      tags: data.tags || [],
      opt_out_sms: data.opt_out_sms || false,
      opt_out_calls: data.opt_out_calls || false,
    }

    // Generate personalized greeting suggestion
    const greeting = generateGreeting(contact)

    return NextResponse.json({
      success: true,
      found: true,
      contact,
      greeting,
      message: `Found contact: ${contact.name}`,
    })
  } catch (error: any) {
    console.error('Error looking up contact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to lookup contact' },
      { status: 500 }
    )
  }
}

/**
 * Generate personalized greeting based on contact history
 */
function generateGreeting(contact: any): string {
  const name = contact.name || 'there'

  // First-time caller
  if (!contact.call_count || contact.call_count === 0) {
    return `Hello ${name}! Thanks for calling us today.`
  }

  // Returning caller
  if (contact.call_count === 1) {
    return `Hi ${name}, great to hear from you again!`
  }

  // Frequent caller
  if (contact.call_count >= 3) {
    return `Hello ${name}, always a pleasure to speak with you!`
  }

  // Has previous booking
  if (contact.booking_count && contact.booking_count > 0) {
    return `Hi ${name}, welcome back! How can I help you today?`
  }

  return `Hello ${name}, how can I assist you today?`
}
