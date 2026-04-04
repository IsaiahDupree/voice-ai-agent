// F0584: Contact enrichment API

import { NextRequest, NextResponse } from 'next/server'
import { enrichAndSaveContact, batchEnrichContacts } from '@/lib/contact-enrichment'

/**
 * POST /api/contacts/enrich
 * Enrich a single contact or batch of contacts
 *
 * Body: { contactId: string } or { contactIds: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { contactId, contactIds } = body

    // Batch enrichment
    if (contactIds && Array.isArray(contactIds)) {
      if (contactIds.length === 0) {
        return NextResponse.json({ error: 'contactIds array is empty' }, { status: 400 })
      }

      if (contactIds.length > 100) {
        return NextResponse.json(
          { error: 'Maximum 100 contacts per batch request' },
          { status: 400 }
        )
      }

      const result = await batchEnrichContacts(contactIds)

      return NextResponse.json({
        success: result.success > 0,
        enriched: result.success,
        failed: result.failed,
        total: result.total,
        message: `Enriched ${result.success}/${result.total} contacts`,
      })
    }

    // Single contact enrichment
    if (contactId) {
      const result = await enrichAndSaveContact(contactId)

      if (!result.success) {
        return NextResponse.json(
          { error: 'Failed to enrich contact' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        enrichmentData: result.enrichmentData,
        message: result.enrichmentData
          ? 'Contact enriched successfully'
          : 'No enrichment data found',
      })
    }

    return NextResponse.json(
      { error: 'Missing contactId or contactIds parameter' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error enriching contact:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to enrich contact' },
      { status: 500 }
    )
  }
}
