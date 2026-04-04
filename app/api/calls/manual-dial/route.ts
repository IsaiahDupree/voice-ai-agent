// F0247: Manual dial option - Allow manual single-number dial from dashboard
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to_number, assistant_id, campaign_id, contact_id } = body

    if (!to_number || !assistant_id) {
      return NextResponse.json(
        { error: 'Missing required fields: to_number, assistant_id' },
        { status: 400 }
      )
    }

    // Get assistant config
    const { data: assistant, error: assistantError } = await supabaseAdmin
      .from('voice_agent_assistants')
      .select('*')
      .eq('id', assistant_id)
      .single()

    if (assistantError || !assistant) {
      return NextResponse.json(
        { error: 'Assistant not found' },
        { status: 404 }
      )
    }

    // Create outbound call via Vapi API
    const vapiApiKey = process.env.VAPI_API_KEY
    if (!vapiApiKey) {
      return NextResponse.json(
        { error: 'VAPI_API_KEY not configured' },
        { status: 500 }
      )
    }

    const vapiResponse = await fetch('https://api.vapi.ai/call', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assistantId: assistant.vapi_assistant_id || assistant_id,
        customer: {
          number: to_number,
        },
        phoneNumberId: assistant.phone_number_id,
      }),
    })

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text()
      console.error('Vapi call creation failed:', errorText)
      return NextResponse.json(
        { error: `Vapi API error: ${errorText}` },
        { status: vapiResponse.status }
      )
    }

    const callData = await vapiResponse.json()

    // Store call record in database
    const { data: dbCall, error: dbError } = await supabaseAdmin
      .from('voice_agent_calls')
      .insert({
        call_id: callData.id,
        assistant_id,
        status: 'queued',
        direction: 'outbound',
        from_number: assistant.phone_number,
        to_number,
        campaign_id: campaign_id || null,
        contact_id: contact_id || null,
        started_at: new Date().toISOString(),
        metadata: {
          manual_dial: true,
          vapi_call_data: callData,
        },
      })
      .select()
      .single()

    if (dbError) {
      console.error('Failed to store call in database:', dbError)
      // Call was still initiated, just log the error
    }

    return NextResponse.json({
      success: true,
      call: {
        id: callData.id,
        status: callData.status,
        to_number,
        assistant_id,
      },
      db_call: dbCall,
    })
  } catch (error: any) {
    console.error('Manual dial error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to initiate call' },
      { status: 500 }
    )
  }
}
