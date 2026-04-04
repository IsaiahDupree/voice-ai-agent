// F0956: POST /api/test/call - Places test call to configured number

import { NextRequest, NextResponse } from 'next/server'
import { vapiClient } from '@/lib/vapi'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F0956: POST /api/test/call
 * Places a test call to verify persona configuration
 * Useful for testing voice, persona, and call flow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      phoneNumber,
      assistantId,
      personaId,
      testMessage = 'This is a test call to verify your voice agent configuration.',
    } = body

    // Get test phone number from env if not provided
    const testPhone = phoneNumber || process.env.TEST_PHONE_NUMBER

    if (!testPhone) {
      return NextResponse.json(
        { error: 'phoneNumber is required (or set TEST_PHONE_NUMBER env var)' },
        { status: 400 }
      )
    }

    // Validate phone number format
    if (!/^\+?[1-9]\d{1,14}$/.test(testPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Use E.164 format (e.g., +14155551234)' },
        { status: 400 }
      )
    }

    // Get assistant_id from persona if personaId provided
    let vapiAssistantId = assistantId
    if (!vapiAssistantId && personaId) {
      const { data: persona } = await supabaseAdmin
        .from('personas')
        .select('vapi_assistant_id')
        .eq('id', personaId)
        .single()

      vapiAssistantId = persona?.vapi_assistant_id
    }

    // Use default assistant if none specified
    if (!vapiAssistantId) {
      vapiAssistantId = process.env.VAPI_DEFAULT_ASSISTANT_ID
    }

    if (!vapiAssistantId) {
      return NextResponse.json(
        { error: 'No assistant ID found. Provide assistantId, personaId, or set VAPI_DEFAULT_ASSISTANT_ID env var' },
        { status: 400 }
      )
    }

    // Initiate test call via Vapi
    const callResponse = await vapiClient.post('/call', {
      assistantId: vapiAssistantId,
      customer: {
        number: testPhone,
      },
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
      metadata: {
        is_test: true,
        test_message: testMessage,
        initiated_at: new Date().toISOString(),
      },
    })

    // Log test call in database
    const { data: callLog } = await supabaseAdmin
      .from('voice_agent_calls')
      .insert({
        call_id: callResponse.data.id,
        direction: 'outbound',
        to_number: testPhone,
        from_number: process.env.VAPI_PHONE_NUMBER || 'test',
        assistant_id: vapiAssistantId,
        status: 'initiated',
        is_test: true,
        metadata: {
          is_test: true,
          test_message: testMessage,
        },
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    return NextResponse.json(
      {
        success: true,
        message: `Test call initiated to ${testPhone}`,
        call: {
          id: callResponse.data.id,
          dbId: callLog?.id,
          toNumber: testPhone,
          assistantId: vapiAssistantId,
          status: 'initiated',
          isTest: true,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error initiating test call:', error)

    // Provide helpful error messages
    if (error.response?.status === 401) {
      return NextResponse.json(
        { error: 'Invalid Vapi API key. Check VAPI_API_KEY env var' },
        { status: 401 }
      )
    }

    if (error.response?.status === 404) {
      return NextResponse.json(
        { error: 'Assistant not found. Check assistant ID' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Failed to initiate test call' },
      { status: 500 }
    )
  }
}
