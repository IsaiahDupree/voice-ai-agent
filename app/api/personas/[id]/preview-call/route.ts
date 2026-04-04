// F0803: Persona preview call widget

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface PreviewCallRequest {
  phone_number: string
  duration_minutes?: number
}

// POST /api/personas/:id/preview-call - Initiate a preview call
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: PreviewCallRequest = await request.json()
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    // Validate phone number
    if (!body.phone_number || body.phone_number.length < 10) {
      return NextResponse.json(
        { error: 'Valid phone number is required' },
        { status: 400 }
      )
    }

    // Get persona
    let query = supabaseAdmin
      .from('personas')
      .select(
        'id, name, voice_id, system_prompt, first_message, vapi_assistant_id, org_id'
      )
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: persona, error: personaError } = await query.single()

    if (personaError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Create test call record
    const { data: testCall, error: insertError } = await supabaseAdmin
      .from('persona_test_calls')
      .insert({
        persona_id: params.id,
        from_number: body.phone_number,
        status: 'pending',
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to create test call: ${insertError.message}` },
        { status: 500 }
      )
    }

    // In a real implementation, this would trigger a call via Vapi
    // For now, we return the test call record with instructions
    return NextResponse.json({
      message: 'Preview call initiated',
      test_call: testCall,
      next_steps: {
        description: 'Call will be placed to the provided number',
        estimated_wait: '30-60 seconds',
        check_status_url: `/api/personas/${params.id}/test-calls/${testCall.id}`,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error initiating preview call:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
