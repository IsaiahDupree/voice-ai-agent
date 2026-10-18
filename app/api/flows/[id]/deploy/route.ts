// voiceai:flow-deploy-001 — Deploy a saved flow as a Vapi assistant config

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { exportFlowToVapiConfig } from '@/lib/flow-export'
import { createAssistant, updateAssistant } from '@/lib/vapi'
import type { ConversationFlow } from '@/lib/flow-types'
import type { VapiAssistant } from '@/lib/vapi'

/**
 * POST /api/flows/:id/deploy
 * Converts the saved ReactFlow JSON to a Vapi assistant config and upserts it via Vapi API.
 * Stores the deployed assistant ID and last_deployed_at on the flow record.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const tenantId = searchParams.get('tenant_id') || 'default'

    // Fetch the flow from Supabase
    const { data: flow, error: fetchError } = await supabaseAdmin
      .from('conversation_flows')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !flow) {
      return NextResponse.json({ error: 'Flow not found' }, { status: 404 })
    }

    // Convert ReactFlow JSON → Vapi assistant config
    const exportResult = exportFlowToVapiConfig(flow as ConversationFlow)
    const assistantConfig = exportResult.assistant_config as unknown as VapiAssistant

    let vapiAssistantId: string = flow.vapi_assistant_id

    if (vapiAssistantId) {
      // Update existing Vapi assistant
      await updateAssistant(vapiAssistantId, assistantConfig)
    } else {
      // Create new Vapi assistant
      const created = await createAssistant(assistantConfig)
      vapiAssistantId = created.id
    }

    const deployedAt = new Date().toISOString()

    // Persist assistant ID and deploy timestamp back to the flow record
    await supabaseAdmin
      .from('conversation_flows')
      .update({
        vapi_assistant_id: vapiAssistantId,
        last_deployed_at: deployedAt,
        updated_at: deployedAt,
      })
      .eq('id', id)

    return NextResponse.json({
      success: true,
      vapi_assistant_id: vapiAssistantId,
      last_deployed_at: deployedAt,
    })
  } catch (error: any) {
    console.error('Flow deploy error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
