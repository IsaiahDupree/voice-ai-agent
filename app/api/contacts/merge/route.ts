import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0591: POST /api/contacts/merge - Merge two contacts into one
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceContactId, targetContactId, keepData = 'target' } = body

    if (!sourceContactId || !targetContactId) {
      return NextResponse.json(
        { error: 'sourceContactId and targetContactId are required' },
        { status: 400 }
      )
    }

    if (sourceContactId === targetContactId) {
      return NextResponse.json(
        { error: 'Cannot merge a contact with itself' },
        { status: 400 }
      )
    }

    // Fetch both contacts
    const { data: sourceContact, error: sourceError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('id', sourceContactId)
      .single()

    const { data: targetContact, error: targetError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('*')
      .eq('id', targetContactId)
      .single()

    if (sourceError || !sourceContact || targetError || !targetContact) {
      return NextResponse.json(
        { error: 'One or both contacts not found' },
        { status: 404 }
      )
    }

    // Prepare merged contact
    let mergedContact = { ...targetContact }

    if (keepData === 'source') {
      mergedContact = { ...sourceContact, id: targetContactId }
    } else {
      // keepData === 'target' - merge source fields into target where target is empty
      for (const key in sourceContact) {
        if (
          key !== 'id' &&
          !mergedContact[key] &&
          sourceContact[key]
        ) {
          mergedContact[key] = sourceContact[key]
        }
      }
    }

    // Merge tags
    const sourceTags = sourceContact.tags || []
    const targetTags = mergedContact.tags || []
    mergedContact.tags = Array.from(new Set([...sourceTags, ...targetTags]))

    // Update target contact with merged data
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .update(mergedContact)
      .eq('id', targetContactId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    // Delete source contact
    const { error: deleteError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .delete()
      .eq('id', sourceContactId)

    if (deleteError) {
      console.error('Error deleting source contact:', deleteError)
    }

    return NextResponse.json({
      success: true,
      message: `Contact ${sourceContactId} merged into ${targetContactId}`,
      merged_contact: updated,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error merging contacts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to merge contacts' },
      { status: 500 }
    )
  }
}
