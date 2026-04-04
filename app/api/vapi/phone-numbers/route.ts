import { NextRequest, NextResponse } from 'next/server'
import { createPhoneNumber, listPhoneNumbers } from '@/lib/vapi'

// F0054: Phone number create - purchases and activates new phone number
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const phoneNumber = await createPhoneNumber(body)

    return NextResponse.json(phoneNumber, { status: 201 })
  } catch (error: any) {
    console.error('Error creating phone number:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to create phone number',
        code: error.code,
      },
      { status: error.statusCode || 500 }
    )
  }
}

// F0055: Phone number list - returns all purchased numbers
export async function GET() {
  try {
    const phoneNumbers = await listPhoneNumbers()
    return NextResponse.json(phoneNumbers)
  } catch (error: any) {
    console.error('Error listing phone numbers:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to list phone numbers',
        code: error.code,
      },
      { status: error.statusCode || 500 }
    )
  }
}
