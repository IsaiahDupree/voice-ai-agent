// F0600: Contact health check API

import { NextRequest, NextResponse } from 'next/server'
import { checkContactHealth } from '@/lib/contact-management'

/**
 * GET /api/contacts/:id/health
 * F0600: Check contact data quality health score
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

    const health = await checkContactHealth(contactId)

    return NextResponse.json(health)
  } catch (error: any) {
    console.error('[Contact Health API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
