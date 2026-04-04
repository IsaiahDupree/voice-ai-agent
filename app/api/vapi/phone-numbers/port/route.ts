import { NextRequest, NextResponse } from 'next/server'
import { portPhoneNumber } from '@/lib/vapi'

// F0156: POST /api/vapi/phone-numbers/port - Port existing phone number to Vapi
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      phoneNumber,
      provider,
      accountSid,
      accountToken,
      assistantId,
      description,
    } = body

    if (!phoneNumber || !provider) {
      return NextResponse.json(
        { error: 'phoneNumber and provider are required' },
        { status: 400 }
      )
    }

    const portedNumber = await portPhoneNumber({
      phoneNumber,
      provider,
      accountSid,
      accountToken,
      assistantId,
      description,
    })

    return NextResponse.json(portedNumber, { status: 201 })
  } catch (error: any) {
    console.error('Error porting phone number:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to port phone number',
        code: error.code,
      },
      { status: error.statusCode || 500 }
    )
  }
}
