import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Get campaign details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error) throw error

    // Get contact count
    const { count } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', params.id)

    return NextResponse.json({
      success: true,
      campaign: {
        ...data,
        contact_count: count || 0,
      },
    })
  } catch (error: any) {
    console.error('Error fetching campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch campaign' },
      { status: 500 }
    )
  }
}

// Update campaign
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const updates = {
      ...body,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update(updates)
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      campaign: data,
    })
  } catch (error: any) {
    console.error('Error updating campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update campaign' },
      { status: 500 }
    )
  }
}

// Delete campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .delete()
      .eq('id', params.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete campaign' },
      { status: 500 }
    )
  }
}
