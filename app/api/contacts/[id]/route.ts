// F0571: GET /api/contacts/[id] - Get contact by ID

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F0571: Get contact by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
      }
      console.error('[Contacts] Error fetching contact:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Contacts] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contact' },
      { status: 500 }
    )
  }
}

/**
 * Update contact
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    if (!id) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    const { name, email, phone, company, metadata, sms_consent } = body

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (company !== undefined) updateData.company = company
    if (metadata !== undefined) updateData.metadata = metadata
    if (sms_consent !== undefined) updateData.sms_consent = sms_consent

    const { data, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[Contacts] Error updating contact:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Contacts] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update contact' },
      { status: 500 }
    )
  }
}

/**
 * Delete contact
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('[Contacts] Error deleting contact:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Contacts] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete contact' },
      { status: 500 }
    )
  }
}
