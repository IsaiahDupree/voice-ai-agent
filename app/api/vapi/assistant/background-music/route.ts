// F1402: Assistant background music vol - Configure background music volume level
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { assistant_id, background_music_url, volume } = body

    if (!assistant_id) {
      return NextResponse.json(
        { error: 'assistant_id is required' },
        { status: 400 }
      )
    }

    // Volume should be between 0 and 1
    if (volume !== undefined && (volume < 0 || volume > 1)) {
      return NextResponse.json(
        { error: 'volume must be between 0 and 1' },
        { status: 400 }
      )
    }

    // Update assistant config in Vapi
    const vapiApiKey = process.env.VAPI_API_KEY
    if (!vapiApiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY not configured' },
        { status: 500 }
      )
    }

    const vapiResponse = await fetch(`https://api.vapi.ai/assistant/${assistant_id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        backgroundSound: background_music_url,
        backgroundSoundVolume: volume !== undefined ? volume : 0.1,
      }),
    })

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text()
      console.error('Vapi update failed:', errorText)
      return NextResponse.json(
        { error: `Vapi API error: ${errorText}` },
        { status: vapiResponse.status }
      )
    }

    const vapiData = await vapiResponse.json()

    // Update in local database
    await supabaseAdmin
      .from('voice_agent_assistants')
      .update({
        background_music_url,
        background_music_volume: volume !== undefined ? volume : 0.1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', assistant_id)

    return NextResponse.json({
      success: true,
      assistant: vapiData,
    })
  } catch (error: any) {
    console.error('Update background music error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update background music' },
      { status: 500 }
    )
  }
}
