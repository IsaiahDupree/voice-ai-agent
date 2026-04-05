/**
 * Feature 176: Export Flow to Vapi Assistant Config
 * POST /api/flows/:id/export - Export flow as Vapi assistant config + system prompt
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { exportFlowToVapiConfig } from '@/lib/flow-export'
import type { ConversationFlow } from '@/lib/flow-types'

/**
 * Export conversation flow to Vapi assistant configuration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id') || 'default'

    // Fetch flow
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

    // Export to Vapi config
    const exportResult = exportFlowToVapiConfig({
      id: flow.id,
      tenant_id: flow.tenant_id,
      name: flow.name,
      description: flow.description,
      nodes: flow.nodes,
      edges: flow.edges,
      version: flow.version,
      vapi_assistant_id: flow.vapi_assistant_id,
      is_active: flow.is_active,
    } as ConversationFlow)

    // Optional: Create assistant in Vapi API (if VAPI_API_KEY is set)
    let vapiAssistantId: string | undefined
    if (process.env.VAPI_API_KEY) {
      try {
        const vapiResponse = await fetch(
          'https://api.vapi.ai/assistant',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(exportResult.assistant_config),
          }
        )

        if (vapiResponse.ok) {
          const vapiData = await vapiResponse.json()
          vapiAssistantId = vapiData.id

          // Update flow with Vapi assistant ID
          await supabaseAdmin
            .from('conversation_flows')
            .update({ vapi_assistant_id: vapiAssistantId })
            .eq('id', id)
            .eq('tenant_id', tenantId)
        } else {
          console.error(
            'Failed to create Vapi assistant:',
            await vapiResponse.text()
          )
        }
      } catch (vapiError) {
        console.error('Error calling Vapi API:', vapiError)
      }
    }

    return NextResponse.json({
      ...exportResult,
      vapi_assistant_id: vapiAssistantId,
      message: vapiAssistantId
        ? 'Flow exported and Vapi assistant created successfully'
        : 'Flow exported successfully (Vapi assistant not created - set VAPI_API_KEY)',
    })
  } catch (error: any) {
    console.error('Error in POST /api/flows/:id/export:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
