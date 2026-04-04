// F1169: Contact data portability - Export all contact PII
import { NextRequest, NextResponse } from 'next/server'
import { exportContactData } from '@/lib/gdpr-compliance'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = params.id

    const data = await exportContactData(contactId)

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Contact export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export contact data' },
      { status: 500 }
    )
  }
}
