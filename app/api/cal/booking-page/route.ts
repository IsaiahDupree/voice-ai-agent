import { NextRequest, NextResponse } from 'next/server'

// F0321: GET /api/cal/booking-page - Return Cal.com booking page URL for event type
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventTypeSlug = searchParams.get('slug')
    const username = searchParams.get('username')

    if (!eventTypeSlug || !username) {
      return NextResponse.json(
        { error: 'slug and username are required' },
        { status: 400 }
      )
    }

    // Cal.com booking page URL format: https://cal.com/[username]/[event-slug]
    const calComUsername = process.env.CALCOM_USERNAME || username
    const bookingPageUrl = `https://cal.com/${calComUsername}/${eventTypeSlug}`

    return NextResponse.json({
      success: true,
      booking_page_url: bookingPageUrl,
      slug: eventTypeSlug,
      username: calComUsername,
      full_url: bookingPageUrl,
    })
  } catch (error: any) {
    console.error('Error generating booking page URL:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate booking page URL' },
      { status: 500 }
    )
  }
}
