// F1002: PATCH /api/contacts/:id/stage - Update contact deal stage

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface RouteParams {
  params: { id: string }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const contactId = params.id
    const { stage } = await request.json()

    if (!contactId) {
      return NextResponse.json(
        { error: 'Contact ID is required' },
        { status: 400 }
      )
    }

    if (!stage) {
      return NextResponse.json(
        { error: 'Stage is required' },
        { status: 400 }
      )
    }

    // Validate stage value
    const validStages = ['lead', 'prospect', 'qualified', 'negotiation', 'closed-won', 'closed-lost']
    if (!validStages.includes(stage)) {
      return NextResponse.json(
        { error: `Stage must be one of: ${validStages.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    // Update contact stage
    const { data, error } = await supabase
      .from('voice_agent_contacts')
      .update({ stage, updated_at: new Date().toISOString() })
      .eq('id', contactId)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to update contact stage' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Contact stage updated to ${stage}`,
      contact: data
    })
  } catch (error) {
    console.error('Error updating contact stage:', error)
    return NextResponse.json(
      { error: 'Failed to update contact stage' },
      { status: 500 }
    )
  }
}
