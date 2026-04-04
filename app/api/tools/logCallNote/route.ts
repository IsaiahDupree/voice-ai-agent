import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0430: logCallNote tool - append note to CRM contact during call
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, note, category = 'general', call_id } = body

    if (!phone || !note) {
      return NextResponse.json(
        { error: 'phone and note are required' },
        { status: 400 }
      )
    }

    // 1. Look up or create contact
    let contact
    const { data: existingContact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('phone', phone)
      .single()

    if (existingContact) {
      contact = existingContact
    } else {
      // Create new contact if doesn't exist
      const { data: newContact, error: createError } = await supabaseAdmin
        .from('voice_agent_contacts')
        .insert({
          phone,
          notes: [],
          created_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (createError) {
        console.error('Error creating contact:', createError)
        return NextResponse.json(
          { error: 'Failed to create contact' },
          { status: 500 }
        )
      }

      contact = newContact
    }

    // 2. Append note to contact's notes array
    const newNote = {
      content: note,
      category,
      call_id: call_id || null,
      timestamp: new Date().toISOString(),
    }

    const existingNotes = contact.notes || []
    const updatedNotes = [...existingNotes, newNote]

    const { data: updatedContact, error: updateError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contact.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating contact notes:', updateError)
      return NextResponse.json(
        { error: 'Failed to update contact' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      contact: updatedContact,
      note: newNote,
    })
  } catch (error: any) {
    console.error('Error in logCallNote:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to log note' },
      { status: 500 }
    )
  }
}
