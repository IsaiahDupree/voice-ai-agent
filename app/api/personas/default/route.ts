// F0806: Default persona - GET/POST default persona for organization

import { NextRequest, NextResponse } from 'next/server'
import { getDefaultPersona, setDefaultPersona } from '@/lib/persona-builder'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || 'default-org'

    const persona = await getDefaultPersona(orgId)

    return NextResponse.json({
      default: persona,
      orgId
    })
  } catch (error) {
    console.error('Error fetching default persona:', error)
    return NextResponse.json(
      { error: 'Failed to fetch default persona' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const orgId = request.headers.get('x-org-id') || 'default-org'
    const { personaId } = await request.json()

    if (!personaId) {
      return NextResponse.json(
        { error: 'Persona ID is required' },
        { status: 400 }
      )
    }

    // Verify persona exists and belongs to org
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data: persona, error: fetchError } = await supabase
      .from('personas')
      .select('id, org_id')
      .eq('id', personaId)
      .single()

    if (fetchError || !persona) {
      return NextResponse.json(
        { error: 'Persona not found' },
        { status: 404 }
      )
    }

    if (persona.org_id !== orgId) {
      return NextResponse.json(
        { error: 'Persona does not belong to this organization' },
        { status: 403 }
      )
    }

    const success = await setDefaultPersona(personaId, orgId)

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to set default persona' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Default persona set successfully'
    })
  } catch (error) {
    console.error('Error setting default persona:', error)
    return NextResponse.json(
      { error: 'Failed to set default persona' },
      { status: 500 }
    )
  }
}
