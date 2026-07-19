import { NextRequest, NextResponse } from 'next/server'
import { deletePhoneNumber } from '@/lib/vapi'

// F0056: Phone number delete - releases and deactivates phone number
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

  try {
    await deletePhoneNumber(id)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting phone number:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to delete phone number',
        code: error.code,
      },
      { status: error.statusCode || 500 }
    )
  }
}
