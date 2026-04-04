/**
 * Feature 132-133: Tenant-specific operations
 * GET /api/tenants/:id - Get tenant details
 * PUT /api/tenants/:id - Update tenant config
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Feature 132: Get tenant details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data: tenant, error } = await supabaseAdmin
      .from('tenants')
      .select('*, tenant_configs(*)')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Get additional stats
    const [callsResult, contactsResult, documentsResult] = await Promise.all([
      supabaseAdmin
        .from('voice_agent_calls')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id),
      supabaseAdmin
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id),
      supabaseAdmin
        .from('kb_documents')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', id),
    ])

    return NextResponse.json({
      tenant,
      stats: {
        total_calls: callsResult.count || 0,
        total_contacts: contactsResult.count || 0,
        total_documents: documentsResult.count || 0,
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/tenants/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Feature 133: Update tenant config
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    // Separate tenant updates from config updates
    const {
      name,
      phone_numbers,
      plan,
      settings,
      // Config fields
      assistant_id,
      persona_name,
      voice_id,
      system_prompt,
      timezone,
      business_hours,
      kb_namespace,
      ...otherUpdates
    } = body

    // Update tenant if any tenant fields provided
    if (name || phone_numbers || plan || settings) {
      const tenantUpdates: any = {
        updated_at: new Date().toISOString(),
      }

      if (name) tenantUpdates.name = name
      if (phone_numbers !== undefined) tenantUpdates.phone_numbers = phone_numbers
      if (plan) tenantUpdates.plan = plan
      if (settings !== undefined) tenantUpdates.settings = settings

      const { error: tenantError } = await supabaseAdmin
        .from('tenants')
        .update(tenantUpdates)
        .eq('id', id)

      if (tenantError) {
        console.error('Error updating tenant:', tenantError)
        return NextResponse.json(
          { error: tenantError.message },
          { status: 500 }
        )
      }
    }

    // Update tenant_config if any config fields provided
    if (
      assistant_id !== undefined ||
      persona_name !== undefined ||
      voice_id !== undefined ||
      system_prompt !== undefined ||
      timezone ||
      business_hours !== undefined ||
      kb_namespace
    ) {
      const configUpdates: any = {
        updated_at: new Date().toISOString(),
      }

      if (assistant_id !== undefined) configUpdates.assistant_id = assistant_id
      if (persona_name !== undefined) configUpdates.persona_name = persona_name
      if (voice_id !== undefined) configUpdates.voice_id = voice_id
      if (system_prompt !== undefined) configUpdates.system_prompt = system_prompt
      if (timezone) configUpdates.timezone = timezone
      if (business_hours !== undefined) configUpdates.business_hours = business_hours
      if (kb_namespace) configUpdates.kb_namespace = kb_namespace

      const { error: configError } = await supabaseAdmin
        .from('tenant_configs')
        .update(configUpdates)
        .eq('tenant_id', id)

      if (configError) {
        console.error('Error updating tenant config:', configError)
        return NextResponse.json(
          { error: configError.message },
          { status: 500 }
        )
      }
    }

    // Fetch updated tenant data
    const { data: tenant, error: fetchError } = await supabaseAdmin
      .from('tenants')
      .select('*, tenant_configs(*)')
      .eq('id', id)
      .single()

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tenant,
      message: 'Tenant updated successfully',
    })
  } catch (error: any) {
    console.error('Error in PUT /api/tenants/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * Delete tenant
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Prevent deleting default tenant
    if (id === 'default') {
      return NextResponse.json(
        { error: 'Cannot delete default tenant' },
        { status: 403 }
      )
    }

    const { error } = await supabaseAdmin
      .from('tenants')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting tenant:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Tenant deleted successfully' })
  } catch (error: any) {
    console.error('Error in DELETE /api/tenants/:id:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
