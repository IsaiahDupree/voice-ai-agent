// F0623: Contact bulk update

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface BulkUpdateRequest {
  org_id: string
  contact_ids: string[]
  updates: {
    status?: string
    tags?: string[]
    pipeline_stage?: string
    custom_field?: Record<string, any>
  }
}

// POST /api/crm/contacts/bulk-update - Update multiple contacts
export async function POST(request: NextRequest) {
  try {
    const body: BulkUpdateRequest = await request.json()

    if (!body.org_id || !body.contact_ids || body.contact_ids.length === 0) {
      return NextResponse.json(
        { error: 'org_id and contact_ids array are required' },
        { status: 400 }
      )
    }

    if (!body.updates || Object.keys(body.updates).length === 0) {
      return NextResponse.json(
        { error: 'updates object with at least one field is required' },
        { status: 400 }
      )
    }

    if (body.contact_ids.length > 1000) {
      return NextResponse.json(
        { error: 'Maximum 1000 contacts per batch' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (body.updates.status) updateData.status = body.updates.status
    if (body.updates.tags) updateData.tags = body.updates.tags
    if (body.updates.pipeline_stage) updateData.pipeline_stage = body.updates.pipeline_stage
    if (body.updates.custom_field) {
      updateData.custom_fields = body.updates.custom_field
    }

    // Update contacts
    const { error: updateError, count } = await supabaseAdmin
      .from('crm_contacts')
      .update(updateData)
      .eq('org_id', body.org_id)
      .in('id', body.contact_ids)

    if (updateError) {
      return NextResponse.json(
        { error: `Bulk update failed: ${updateError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Contacts updated',
      updated_count: count || 0,
      requested_count: body.contact_ids.length,
      updates_applied: body.updates,
    })
  } catch (error: any) {
    console.error('Error in bulk update:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
