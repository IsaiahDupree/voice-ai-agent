import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0583: GET /api/contacts/tags - Get all tags or tags for a contact
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')

    if (contactId) {
      // Get tags for a specific contact
      const { data: contact, error: contactError } = await supabaseAdmin
        .from('voice_agent_contacts')
        .select('tags')
        .eq('id', contactId)
        .single()

      if (contactError || !contact) {
        return NextResponse.json(
          { error: 'Contact not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        contact_id: contactId,
        tags: contact.tags || [],
      })
    }

    // Get all unique tags
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('tags')

    if (contactsError) {
      throw contactsError
    }

    const allTags = new Set<string>()
    contacts?.forEach((contact) => {
      if (contact.tags && Array.isArray(contact.tags)) {
        contact.tags.forEach((tag: string) => allTags.add(tag))
      }
    })

    return NextResponse.json({
      success: true,
      tags: Array.from(allTags).sort(),
      total_unique_tags: allTags.size,
    })
  } catch (error: any) {
    console.error('Error fetching tags:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch tags' },
      { status: 500 }
    )
  }
}

// F0583: POST /api/contacts/tags - Add tags to a contact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactId, tags } = body

    if (!contactId || !tags || !Array.isArray(tags)) {
      return NextResponse.json(
        { error: 'contactId and tags array are required' },
        { status: 400 }
      )
    }

    // Get existing tags
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('tags')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Merge tags (avoid duplicates)
    const existingTags = contact.tags || []
    const mergedTags = Array.from(new Set([...existingTags, ...tags]))

    // Update contact
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update({ tags: mergedTags })
      .eq('id', contactId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      message: `Added tags to contact ${contactId}`,
      tags: updated.tags,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error adding tags:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add tags' },
      { status: 500 }
    )
  }
}

// F0583: DELETE /api/contacts/tags - Remove tags from a contact
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('contactId')
    const tagsToRemove = searchParams.getAll('tag')

    if (!contactId || tagsToRemove.length === 0) {
      return NextResponse.json(
        { error: 'contactId and tag parameters are required' },
        { status: 400 }
      )
    }

    // Get existing tags
    const { data: contact, error: contactError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('tags')
      .eq('id', contactId)
      .single()

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    // Remove tags
    const existingTags = contact.tags || []
    const updatedTags = existingTags.filter((tag: string) => !tagsToRemove.includes(tag))

    // Update contact
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update({ tags: updatedTags })
      .eq('id', contactId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      message: `Removed tags from contact ${contactId}`,
      tags: updated.tags,
    })
  } catch (error: any) {
    console.error('Error removing tags:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove tags' },
      { status: 500 }
    )
  }
}
