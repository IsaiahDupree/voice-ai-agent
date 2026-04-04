// F0608: Add note to contact from agent

import { NextRequest, NextResponse } from 'next/server'
import { addContactNote } from '@/lib/contact-management'
import { logContactAudit } from '@/lib/contact-audit'

/**
 * POST /api/contacts/:id/note
 * F0608: Add note from agent to contact
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = parseInt(params.id, 10)

    if (isNaN(contactId)) {
      return NextResponse.json(
        { error: 'Invalid contact ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { note, author } = body

    if (!note || typeof note !== 'string') {
      return NextResponse.json(
        { error: 'Note is required' },
        { status: 400 }
      )
    }

    // Add note
    await addContactNote(contactId, note, author)

    // Log audit event
    await logContactAudit(contactId, 'note_added', author || 'system', {
      metadata: { note },
    })

    return NextResponse.json({ success: true, contactId, note })
  } catch (error: any) {
    console.error('[Contact Note API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
