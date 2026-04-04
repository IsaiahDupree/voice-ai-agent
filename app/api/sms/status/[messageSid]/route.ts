// F0413: GET /api/sms/status/[messageSid] - Check SMS delivery status

import { NextRequest, NextResponse } from 'next/server'
import { checkSMSDeliveryStatus, updateSMSDeliveryStatus } from '@/lib/sms-delivery'

export async function GET(
  request: NextRequest,
  { params }: { params: { messageSid: string } }
) {
  try {
    const { messageSid } = params

    if (!messageSid) {
      return NextResponse.json(
        { error: 'Message SID is required' },
        { status: 400 }
      )
    }

    // F0413: Check delivery status from Twilio
    const deliveryStatus = await checkSMSDeliveryStatus(messageSid)

    return NextResponse.json({
      success: true,
      messageSid,
      ...deliveryStatus
    })
  } catch (error: any) {
    console.error('Error checking SMS delivery status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to check delivery status' },
      { status: 500 }
    )
  }
}

// F0413: POST to update database with latest status
export async function POST(
  request: NextRequest,
  { params }: { params: { messageSid: string } }
) {
  try {
    const { messageSid } = params

    if (!messageSid) {
      return NextResponse.json(
        { error: 'Message SID is required' },
        { status: 400 }
      )
    }

    // F0413: Poll Twilio and update database
    const result = await updateSMSDeliveryStatus(messageSid)

    return NextResponse.json({
      success: true,
      messageSid,
      status: result.status,
      updated: result.updated
    })
  } catch (error: any) {
    console.error('Error updating SMS delivery status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update delivery status' },
      { status: 500 }
    )
  }
}
