// F0151: Max ringing duration configuration API
// Configure max rings before going to voicemail

import { NextRequest, NextResponse } from 'next/server'
import { setMaxRingingDuration, getRingingConfig } from '@/lib/ringing-config'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: assistantId } = params
    const config = await getRingingConfig(assistantId)

    if (!config) {
      return NextResponse.json({
        error: 'Ringing configuration not found',
      }, { status: 404 })
    }

    return NextResponse.json(config)
  } catch (error: any) {
    console.error('Get ringing config error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get ringing configuration' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: assistantId } = params
    const body = await request.json()
    const { max_ring_seconds, voicemail_message } = body

    if (!max_ring_seconds || max_ring_seconds < 5 || max_ring_seconds > 120) {
      return NextResponse.json({
        error: 'max_ring_seconds must be between 5 and 120',
      }, { status: 400 })
    }

    await setMaxRingingDuration(assistantId, max_ring_seconds, voicemail_message)

    const updatedConfig = await getRingingConfig(assistantId)

    return NextResponse.json({
      success: true,
      config: updatedConfig,
    })
  } catch (error: any) {
    console.error('Update ringing config error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update ringing configuration' },
      { status: 500 }
    )
  }
}
