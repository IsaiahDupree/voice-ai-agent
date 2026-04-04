import { NextRequest, NextResponse } from 'next/server'
import { calcomClient } from '@/lib/calcom'

// F0272: Get event types - Returns available Cal.com booking types

export async function GET(request: NextRequest) {
  try {
    const eventTypes = await calcomClient.getEventTypes()

    return NextResponse.json({
      success: true,
      eventTypes,
    })
  } catch (error: any) {
    console.error('Error fetching event types:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch event types' },
      { status: 500 }
    )
  }
}
