import { NextRequest, NextResponse } from 'next/server'

// F019: Create /api/agent/config route (missing — setup/scheduling pages need it)
export async function GET(request: NextRequest) {
  try {
    // Return config from environment variables
    const config = {
      assistant_id: process.env.VAPI_ASSISTANT_ID || null,
      phone_id: process.env.VAPI_PHONE_ID || null,
      calendar_url: null
    }

    return NextResponse.json(config, { status: 200 })
  } catch (error: any) {
    console.error('Error in GET /api/agent/config:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch agent config' },
      { status: 500 }
    )
  }
}

// F019: PUT for updating agent config
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { assistant_id, phone_id, calendar_url } = body

    // In a real implementation, this would persist to a database
    // For now, return the config that was sent
    const config = {
      assistant_id: assistant_id || process.env.VAPI_ASSISTANT_ID || null,
      phone_id: phone_id || process.env.VAPI_PHONE_ID || null,
      calendar_url: calendar_url || null
    }

    return NextResponse.json(config, { status: 200 })
  } catch (error: any) {
    console.error('Error in PUT /api/agent/config:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update agent config' },
      { status: 500 }
    )
  }
}
