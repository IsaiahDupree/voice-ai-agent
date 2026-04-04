// F0585: Contact import CSV

import { NextRequest, NextResponse } from 'next/server'
import { importContactsFromCSV, getImportHistory } from '@/lib/contact-import-export'

/**
 * POST /api/contacts/import
 * F0585: Uploads CSV and imports contacts
 * Expected CSV format: phone,name,email,company,notes
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const upsert = formData.get('upsert') === 'true'
    const skipHeader = formData.get('skipHeader') !== 'false' // Default true
    const importedBy = formData.get('importedBy') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Read file content
    const csvContent = await file.text()

    if (!csvContent || csvContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'CSV file is empty' },
        { status: 400 }
      )
    }

    // Import contacts
    const result = await importContactsFromCSV(csvContent, {
      upsert,
      skipHeader,
      importedBy: importedBy || 'unknown',
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('[Contact Import API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/contacts/import
 * Returns import history
 */
export async function GET() {
  try {
    const history = await getImportHistory(50)

    return NextResponse.json({ imports: history })
  } catch (error: any) {
    console.error('[Contact Import API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
