/**
 * Features 171-172: Flow Management API
 * GET /api/flows - List all flows for a tenant
 * POST /api/flows - Create a new flow
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateFlow } from '@/lib/flow-export'
import type { ConversationFlow } from '@/lib/flow-types'

/**
 * Feature 171: List all conversation flows for a tenant
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id') || 'default'
    const isActive = searchParams.get('is_active') // Optional filter

    let query = supabaseAdmin
      .from('conversation_flows')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })

    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data: flows, error } = await query

    if (error) {
      console.error('Error fetching conversation flows:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      flows: flows || [],
      count: flows?.length || 0,
    })
  } catch (error: any) {
    console.error('Error in GET /api/flows:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Feature 172: Create a new conversation flow
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tenant_id, name, description, nodes, edges } = body

    // Validate required fields
    if (!tenant_id || !name) {
      return NextResponse.json(
        { error: 'tenant_id and name are required' },
        { status: 400 }
      )
    }

    // Validate flow structure
    const flow: ConversationFlow = {
      tenant_id,
      name,
      description,
      nodes: nodes || [],
      edges: edges || [],
      version: 1,
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

    // Check for duplicate name in tenant
    const { data: existing } = await supabaseAdmin
      .from('conversation_flows')
      .select('id')
      .eq('tenant_id', tenant_id)
      .eq('name', name)
      .single()

    if (existing) {
      return NextResponse.json(
        {
          error: `A flow named "${name}" already exists for this tenant`,
        },
        { status: 409 }
      )
    }

    // Create flow
    const { data: newFlow, error } = await supabaseAdmin
      .from('conversation_flows')
      .insert({
        tenant_id,
        name,
        description,
        nodes,
        edges,
        version: 1,
        is_active: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating conversation flow:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(
      {
        flow: newFlow,
        message: 'Flow created successfully',
        validation_warnings: validation.warnings,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error in POST /api/flows:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
