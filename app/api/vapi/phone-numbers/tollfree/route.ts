import { NextRequest, NextResponse } from 'next/server'
import { createTollFreeNumber } from '@/lib/vapi'

// F0157: POST /api/vapi/phone-numbers/tollfree - Purchase toll-free number
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      areaCode,
      name,
      assistantId,
      preferredAreaCode,
    } = body

    const tollFreeNumber = await createTollFreeNumber({
      areaCode: areaCode || preferredAreaCode,
      name,
      assistantId,
      preferredAreaCode,
    })

    return NextResponse.json(tollFreeNumber, { status: 201 })
  } catch (error: any) {
    console.error('Error creating toll-free number:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to create toll-free number',
        code: error.code,
      },
      { status: error.statusCode || 500 }
    )
  }
}
