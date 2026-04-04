// F0996: GET /api/event-types - List all event types

import { NextRequest, NextResponse } from 'next/server'
import { getEventTypes } from '@/lib/event-types'

export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || 'default-org'

    const eventTypes = await getEventTypes(orgId)

    return NextResponse.json({
      eventTypes,
      count: eventTypes.length
    })
  } catch (error) {
    console.error('Error fetching event types:', error)
    return NextResponse.json(
      { error: 'Failed to fetch event types' },
      { status: 500 }
    )
  }
}
