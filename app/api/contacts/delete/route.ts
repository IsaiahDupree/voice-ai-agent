import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// F0574: DELETE /api/contacts/delete - Delete a contact
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const contactId = searchParams.get('id')

    if (!contactId) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 }
      )
    }

    // Delete the contact
    const { error: deleteError } = await supabaseAdmin
      .from('voice_agent_contacts')
      .delete()
      .eq('id', contactId)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: `Contact ${contactId} deleted successfully`,
    })
  } catch (error: any) {
    console.error('Error deleting contact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete contact' },
      { status: 500 }
    )
  }
}

// F0574: POST /api/contacts/delete - Batch delete contacts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'ids array is required and must not be empty' },
        { status: 400 }
      )
    }

    // Delete multiple contacts
    const { error: deleteError, count } = await supabaseAdmin
      .from('voice_agent_contacts')
      .delete()
      .in('id', ids)

    if (deleteError) {
      throw deleteError
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${count} contact(s)`,
      count,
    })
  } catch (error: any) {
    console.error('Error deleting contacts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete contacts' },
      { status: 500 }
    )
  }
}
