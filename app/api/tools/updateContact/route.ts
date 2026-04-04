import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0386, F0387, F0388: updateContact tool - update contact fields including deal stage
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, name, email, deal_stage, tags, company } = body

    if (!phone) {
      return NextResponse.json(
        { error: 'phone is required' },
        { status: 400 }
      )
    }

    // Look up existing contact
    const { data: existingContact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('phone', phone)
      .single()

    if (!existingContact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updates: any = {
      updated_at: new Date().toISOString(),
    }

    if (name) updates.name = name
    if (email) updates.email = email
    if (company) updates.company = company

    // F0388: Update deal_stage
    if (deal_stage) {
      updates.deal_stage = deal_stage
    }

    // Merge tags
    if (tags && Array.isArray(tags)) {
      const existingTags = existingContact.tags || []
      const mergedTags = Array.from(new Set([...existingTags, ...tags]))
      updates.tags = mergedTags
    }

    // Update contact
    const { data: updatedContact, error } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update(updates)
      .eq('id', existingContact.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating contact:', error)
      return NextResponse.json(
        { error: 'Failed to update contact' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      contact: updatedContact,
    })
  } catch (error: any) {
    console.error('Error in updateContact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update contact' },
      { status: 500 }
    )
  }
}
