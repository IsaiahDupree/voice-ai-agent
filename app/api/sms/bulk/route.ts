// F0528: Bulk SMS API endpoint
// F1014: POST /api/sms/bulk - Send bulk SMS
import { NextRequest, NextResponse } from 'next/server'
import { sendBulkSMS } from '@/lib/sms-helpers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to_numbers, message, from_number, scheduled_for } = body

    if (!to_numbers || !Array.isArray(to_numbers) || to_numbers.length === 0) {
      return NextResponse.json(
        { error: 'to_numbers must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      )
    }

    const result = await sendBulkSMS({
      to_numbers,
      message,
      from_number,
      scheduled_for,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Bulk SMS API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send bulk SMS' },
      { status: 500 }
    )
  }
}
