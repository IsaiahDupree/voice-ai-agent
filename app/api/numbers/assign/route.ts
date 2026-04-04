// F1004: POST /api/numbers/assign - Assigns phone number to persona

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F1004: POST /api/numbers/assign
 * Assigns a phone number to a persona (agent)
 * Body:
 *   - phone: Phone number to assign
 *   - personaId: Persona/assistant ID
 *   - provider: Provider name (default: 'vapi')
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, personaId, provider = 'vapi' } = body

    if (!phone || !personaId) {
      return NextResponse.json(
        { error: 'phone and personaId are required' },
        { status: 400 }
      )
    }

    // Check if phone already assigned
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('voice_agent_phone_numbers')
      .select('*')
      .eq('phone', phone)
      .single()

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError
    }

    if (existing) {
      return NextResponse.json(
        { error: 'Phone number already assigned', isDuplicate: true },
        { status: 409 }
      )
    }

    // Verify persona exists
    const { data: persona, error: personaError } = await supabaseAdmin
      .from('voice_agent_personas')
      .select('id')
      .eq('id', personaId)
      .single()

    if (personaError || !persona) {
      return NextResponse.json(
        { error: 'Persona not found', code: 'PERSONA_NOT_FOUND' },
        { status: 404 }
      )
    }

    // Assign number
    const { data: assigned, error: assignError } = await supabaseAdmin
      .from('voice_agent_phone_numbers')
      .insert({
        phone,
        assistant_id: personaId,
        provider,
        status: 'active',
        purchased_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (assignError) {
      throw assignError
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Number assigned to persona',
        assignment: assigned,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error assigning number:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to assign number' },
      { status: 500 }
    )
  }
}
