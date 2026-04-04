import { NextRequest, NextResponse } from 'next/server'
import { configureIVRRouting } from '@/lib/vapi'

// F0175: POST /api/vapi/phone-numbers/ivr - Configure IVR routing for inbound calls
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      phoneNumberId,
      ivroptions,
      greeting,
      defaultAssistantId,
      timeout,
    } = body

    if (!phoneNumberId || !ivroptions || ivroptions.length === 0) {
      return NextResponse.json(
        { error: 'phoneNumberId and ivrOptions are required' },
        { status: 400 }
      )
    }

    const ivrConfig = await configureIVRRouting({
      phoneNumberId,
      ivroptions,
      greeting: greeting || 'Press 1 for sales, 2 for support, or 0 for operator',
      defaultAssistantId,
      timeout: timeout || 5,
    })

    return NextResponse.json(
      {
        success: true,
        message: 'IVR routing configured successfully',
        config: ivrConfig,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error configuring IVR routing:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to configure IVR routing',
        code: error.code,
      },
      { status: error.statusCode || 500 }
    )
  }
}
