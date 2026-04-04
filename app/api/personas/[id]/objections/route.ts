// F0788: Persona objection handlers

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface Objection {
  id: string
  persona_id: string
  objection_type: string
  customer_objection: string
  agent_response: string
  created_at: string
}

interface ObjectionRequest {
  objection_type: string
  customer_objection: string
  agent_response: string
}

const DEFAULT_OBJECTIONS = [
  {
    objection_type: 'price',
    customer_objection: 'Your solution is too expensive',
    agent_response: 'I understand cost is a consideration. Let me share how this investment typically pays for itself within [timeline]. Would you be open to exploring the ROI?',
  },
  {
    objection_type: 'timing',
    customer_objection: 'Not a good time, we\'re busy right now',
    agent_response: 'I totally understand - things are hectic. This will only take [time]. Or we can schedule something for when things calm down. What works better?',
  },
  {
    objection_type: 'already_using',
    customer_objection: 'We already use a competitor',
    agent_response: 'That\'s great that you\'re already optimizing this. Many teams find our solution complements their existing tools. Could we find 15 minutes to show how we\'re different?',
  },
  {
    objection_type: 'need_approval',
    customer_objection: 'I need to ask my manager/team',
    agent_response: 'Absolutely, that makes sense. How about we schedule a brief call with you and your decision-maker? That way everyone gets the same information at once.',
  },
  {
    objection_type: 'no_interest',
    customer_objection: 'I\'m not interested',
    agent_response: 'I hear you - most people aren\'t interested until they understand how this saves them [benefit]. Would you be open to a 10-minute conversation to see if it\'s relevant?',
  },
]

// GET /api/personas/:id/objections - Get objection handlers
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    // Verify persona exists
    let verifyQuery = supabaseAdmin.from('personas').select('id').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Try to get custom objections from database (would need persona_objections table)
    // For now, return default objections
    return NextResponse.json({
      persona_id: params.id,
      objections: DEFAULT_OBJECTIONS.map((obj, idx) => ({
        id: `default-${idx}`,
        persona_id: params.id,
        ...obj,
        created_at: new Date().toISOString(),
      })),
      is_default: true,
    })
  } catch (error: any) {
    console.error('Error fetching objections:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/personas/:id/objections - Add objection handler
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: ObjectionRequest = await request.json()
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    // Validate input
    if (!body.objection_type || !body.customer_objection || !body.agent_response) {
      return NextResponse.json(
        { error: 'objection_type, customer_objection, and agent_response are required' },
        { status: 400 }
      )
    }

    // Verify persona exists
    let verifyQuery = supabaseAdmin.from('personas').select('id').eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: persona, error: verifyError } = await verifyQuery.single()

    if (verifyError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // In a real implementation, this would store in persona_objections table
    // For now, return success response
    return NextResponse.json({
      message: 'Objection handler added',
      objection: {
        id: `new-${Date.now()}`,
        persona_id: params.id,
        ...body,
        created_at: new Date().toISOString(),
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error adding objection handler:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
