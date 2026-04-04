// F0578, F0579: Contact notes API

import { NextRequest, NextResponse } from 'next/server'
import { appendContactNote, getContactNotes } from '@/lib/contact-notes'

/**
 * F0579: GET /api/contacts/[id]/notes - Get contact notes history
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

    const notes = await getContactNotes(contactId)

    return NextResponse.json({ notes })
  } catch (error: any) {
    console.error('[Contact Notes] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notes' },
      { status: 500 }
    )
  }
}

/**
 * F0578: POST /api/contacts/[id]/notes - Append note to contact
 */
export async function POST(
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

    const body = await request.json()
    const { note, source } = body

    if (!note) {
      return NextResponse.json(
        { error: 'Note content is required' },
        { status: 400 }
      )
    }

    await appendContactNote(contactId, note, source)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[Contact Notes] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to append note' },
      { status: 500 }
    )
  }
}
