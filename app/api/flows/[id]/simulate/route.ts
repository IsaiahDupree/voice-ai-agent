/**
 * Flow Simulation API
 * POST /api/flows/:id/simulate - Run text-based simulation of conversation flow
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  simulateConversationFlow,
  formatSimulationAsText,
} from '@/lib/flow-simulator'
import type { ConversationFlow } from '@/lib/flow-types'

/**
 * Simulate a conversation flow with mock user inputs
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { tenant_id, user_inputs, context, format } = body

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(user_inputs)) {
      return NextResponse.json(
        {
          error:
            'user_inputs must be an array of strings (simulated user responses)',
        },
        { status: 400 }
      )
    }

    // Fetch flow
    const { data: flow, error } = await supabaseAdmin
      .from('conversation_flows')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single()

    if (error || !flow) {
      return NextResponse.json(
        { error: 'Flow not found' },
        { status: 404 }
      )
    }

    // Run simulation
    const simulationResult = await simulateConversationFlow(
      {
        id: flow.id,
        tenant_id: flow.tenant_id,
        name: flow.name,
        description: flow.description,
        nodes: flow.nodes,
        edges: flow.edges,
        version: flow.version,
      } as ConversationFlow,
      user_inputs,
      context || {}
    )

    // Format result based on requested format
    if (format === 'text') {
      const textOutput = formatSimulationAsText(simulationResult)
      return new NextResponse(textOutput, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }

    return NextResponse.json({
      simulation: simulationResult,
      flow_name: flow.name,
      flow_version: flow.version,
    })
  } catch (error: any) {
    console.error('Error in POST /api/flows/:id/simulate:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
