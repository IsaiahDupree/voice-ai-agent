// F0617: Contact audit log API

import { NextRequest, NextResponse } from 'next/server'
import { getContactAuditLog } from '@/lib/contact-audit'

/**
 * GET /api/contacts/:id/audit?limit=50&action=updated
 * F0617: Get audit log for a contact
 */
export async function GET(
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

    const searchParams = request.nextUrl.searchParams
    const limitStr = searchParams.get('limit')
    const action = searchParams.get('action') as any

    const limit = limitStr ? parseInt(limitStr, 10) : 50

    const auditLog = await getContactAuditLog(contactId, { limit, action })

    return NextResponse.json({
      contactId,
      auditLog,
      count: auditLog.length,
    })
  } catch (error: any) {
    console.error('[Contact Audit API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
