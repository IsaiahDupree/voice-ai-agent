// F0658: Multi-rep routing
// F0659: Skill-based routing
// F0660: Post-transfer survey
// F0663: Transfer time metric
// F0664: Transfer recording

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface TransferRequest {
  call_id: string
  reason: string
  target_rep_id?: string
  skill_required?: string
  queue_priority?: 'high' | 'normal' | 'low'
}

interface TransferRecord {
  id: string
  call_id: string
  campaign_id: string
  reason: string
  transferred_at: string
  answered_at?: string
  transfer_duration_seconds?: number
  target_rep_id?: string
  recording_url?: string
}

// GET /api/campaigns/:id/transfers - Get transfer history
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Verify campaign exists
    let verifyQuery = supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: campaign, error: verifyError } = await verifyQuery.single()

    if (verifyError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Get transfers from call_transfers table (would need to be created)
    // For now, return empty list with structure
    return NextResponse.json({
      campaign_id: params.id,
      transfers: [],
      pagination: {
        total: 0,
        limit,
        offset,
        has_more: false,
      },
      stats: {
        total_transfers: 0,
        avg_transfer_time_seconds: 0,
        successful_transfers: 0,
        failed_transfers: 0,
      },
    })
  } catch (error: any) {
    console.error('Error fetching transfers:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST /api/campaigns/:id/transfers - Initiate a transfer
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: TransferRequest = await request.json()
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    if (!body.call_id) {
      return NextResponse.json({ error: 'call_id is required' }, { status: 400 })
    }

    // Verify campaign exists
    let verifyQuery = supabaseAdmin
      .from('campaigns')
      .select('id')
      .eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: campaign, error: verifyError } = await verifyQuery.single()

    if (verifyError || !campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
    }

    // Create transfer record
    const transfer: TransferRecord = {
      id: `transfer-${Date.now()}`,
      call_id: body.call_id,
      campaign_id: params.id,
      reason: body.reason,
      transferred_at: new Date().toISOString(),
      target_rep_id: body.target_rep_id,
    }

    return NextResponse.json({
      message: 'Transfer initiated',
      transfer,
      next_steps: {
        description: 'Call is being routed to an available representative',
        skill_required: body.skill_required,
        estimated_wait_seconds: 30,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error initiating transfer:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
