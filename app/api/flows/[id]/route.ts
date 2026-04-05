/**
 * Features 173-175: Individual Flow Operations
 * GET /api/flows/:id - Fetch single flow
 * PUT /api/flows/:id - Update flow
 * DELETE /api/flows/:id - Delete flow
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateFlow } from '@/lib/flow-export'
import type { ConversationFlow } from '@/lib/flow-types'

/**
 * Feature 173: Get a specific conversation flow by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id') || 'default'

    const { data: flow, error } = await supabaseAdmin
      .from('conversation_flows')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (error || !flow) {
      return NextResponse.json(
        { error: 'Flow not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ flow })
  } catch (error: any) {
    console.error('Error in GET /api/flows/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Feature 174: Update a conversation flow
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { tenant_id, name, description, nodes, edges, is_active } = body

    if (!tenant_id) {
      return NextResponse.json(
        { error: 'tenant_id is required' },
        { status: 400 }
      )
    }

    // Fetch existing flow
    const { data: existingFlow, error: fetchError } = await supabaseAdmin
      .from('conversation_flows')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .single()

    if (fetchError || !existingFlow) {
      return NextResponse.json(
        { error: 'Flow not found' },
        { status: 404 }
      )
    }

    // Build updated flow object
    const updatedNodes = nodes !== undefined ? nodes : existingFlow.nodes
    const updatedEdges = edges !== undefined ? edges : existingFlow.edges

    // Validate flow structure if nodes/edges changed
    if (nodes !== undefined || edges !== undefined) {
      const flow: ConversationFlow = {
        tenant_id,
        name: name || existingFlow.name,
        description: description !== undefined ? description : existingFlow.description,
        nodes: updatedNodes,
        edges: updatedEdges,
        version: existingFlow.version,
      }

      const validation = validateFlow(flow)
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Invalid flow structure',
            validation_errors: validation.errors,
            validation_warnings: validation.warnings,
          },
          { status: 400 }
        )
      }
    }

    // Update flow (version auto-increments via trigger if nodes/edges changed)
    const { data: updatedFlow, error: updateError } = await supabaseAdmin
      .from('conversation_flows')
      .update({
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(nodes !== undefined && { nodes }),
        ...(edges !== undefined && { edges }),
        ...(is_active !== undefined && { is_active }),
      })
      .eq('id', id)
      .eq('tenant_id', tenant_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating conversation flow:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      flow: updatedFlow,
      message: 'Flow updated successfully',
    })
  } catch (error: any) {
    console.error('Error in PUT /api/flows/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Feature 175: Delete a conversation flow
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id') || 'default'

    // Check if flow exists
    const { data: existingFlow, error: fetchError } = await supabaseAdmin
      .from('conversation_flows')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !existingFlow) {
      return NextResponse.json(
        { error: 'Flow not found' },
        { status: 404 }
      )
    }

    // Prevent deletion of active flows
    if (existingFlow.is_active) {
      return NextResponse.json(
        {
          error:
            'Cannot delete an active flow. Deactivate it first.',
        },
        { status: 400 }
      )
    }

    // Delete flow
    const { error: deleteError } = await supabaseAdmin
      .from('conversation_flows')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (deleteError) {
      console.error('Error deleting conversation flow:', deleteError)
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Flow deleted successfully',
      deleted_flow_id: id,
    })
  } catch (error: any) {
    console.error('Error in DELETE /api/flows/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
