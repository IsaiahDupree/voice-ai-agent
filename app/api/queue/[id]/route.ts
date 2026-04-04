// F0975: GET /api/queue/:id - Get queue item
// F1007: DELETE /api/queue/:id - Delete queue item

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface QueueItem {
  id: string
  campaign_id: string
  contact_id: string
  phone_number: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  priority: number
  scheduled_for?: string
  created_at: string
}

// GET /api/queue/:id - Get a queue item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    let query = supabaseAdmin
      .from('call_queue')
      .select('*')
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: item, error } = await query.single()

    if (error || !item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
    }

    return NextResponse.json({ queue_item: item })
  } catch (error: any) {
    console.error('Error fetching queue item:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE /api/queue/:id - Delete a queue item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    // Verify item exists
    let verifyQuery = supabaseAdmin
      .from('call_queue')
      .select('id, status')
      .eq('id', params.id)

    if (orgId) {
      verifyQuery = verifyQuery.eq('org_id', orgId)
    }

    const { data: item, error: verifyError } = await verifyQuery.single()

    if (verifyError || !item) {
      return NextResponse.json({ error: 'Queue item not found' }, { status: 404 })
    }

    // Prevent deleting items that are already processing
    if (item.status === 'processing') {
      return NextResponse.json(
        { error: 'Cannot delete queue items that are currently processing' },
        { status: 409 }
      )
    }

    // Delete the queue item
    const { error: deleteError } = await supabaseAdmin
      .from('call_queue')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      return NextResponse.json(
        { error: `Failed to delete queue item: ${deleteError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Queue item deleted',
      deleted_id: params.id,
    })
  } catch (error: any) {
    console.error('Error deleting queue item:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
