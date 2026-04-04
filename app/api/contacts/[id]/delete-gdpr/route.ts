// F1170: Contact data deletion - GDPR right to erasure
import { NextRequest, NextResponse } from 'next/server'
import { deleteContactData } from '@/lib/gdpr-compliance'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contactId = params.id
    const body = await request.json()
    const { reason } = body

    const result = await deleteContactData(contactId, reason)

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Contact deletion error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete contact data' },
      { status: 500 }
    )
  }
}
