// F0586: Contact export CSV

import { NextRequest, NextResponse } from 'next/server'
import { exportContactsToCSV } from '@/lib/contact-import-export'

/**
 * GET /api/contacts/export?campaignId=X
 * F0586: Downloads CSV of all contacts with all fields
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const campaignIdStr = searchParams.get('campaignId')
    const contactIdsStr = searchParams.get('contactIds')
    const includeOptedOut = searchParams.get('includeOptedOut') === 'true'

    const campaignId = campaignIdStr ? parseInt(campaignIdStr, 10) : undefined
    const contactIds = contactIdsStr
      ? contactIdsStr.split(',').map((id) => parseInt(id, 10))
      : undefined

    // Export contacts to CSV
    const csvContent = await exportContactsToCSV({
      campaignId,
      contactIds,
      includeOptedOut,
    })

    // Return as downloadable CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="contacts_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error: any) {
    console.error('[Contact Export API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
