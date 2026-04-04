// F0576, F0577: Contact deal_stage API

import { NextRequest, NextResponse } from 'next/server'
import { updateContactDealStage, DealStage } from '@/lib/contact-notes'

/**
 * F0577: PATCH /api/contacts/[id]/deal-stage - Update contact deal stage
 */
export async function PATCH(
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
    const { dealStage, reason } = body

    // F0576: Validate deal stage
    const validStages: DealStage[] = ['lead', 'qualified', 'booked', 'won', 'lost']
    if (!dealStage || !validStages.includes(dealStage)) {
      return NextResponse.json(
        {
          error: `Invalid deal stage. Must be one of: ${validStages.join(', ')}`,
        },
        { status: 400 }
      )
    }

    await updateContactDealStage(contactId, dealStage as DealStage, reason)

    return NextResponse.json({ success: true, dealStage })
  } catch (error: any) {
    console.error('[Contact Deal Stage] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update deal stage' },
      { status: 500 }
    )
  }
}
