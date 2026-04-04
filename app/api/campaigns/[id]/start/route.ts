import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserFromRequest, requireAdmin } from '@/lib/campaign-rbac'
import { logCampaignAction } from '@/lib/campaign-audit'

// F0185: Batch dial start - Start an outbound calling campaign
// F0253: Campaign RBAC - Only admin can start campaigns
// F0254: Campaign audit log - Log campaign start action

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // F0253: RBAC check - require admin role
    const user = await getUserFromRequest(request)
    const rbacError = requireAdmin(user)
    if (rbacError) return rbacError

    // Verify campaign exists
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError) throw fetchError

    if (campaign.status === 'active') {
      return NextResponse.json(
        { error: 'Campaign is already active' },
        { status: 400 }
      )
    }

    // Check if campaign has contacts
    const { count } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', params.id)
      .eq('status', 'pending')

    if (!count || count === 0) {
      return NextResponse.json(
        { error: 'Campaign has no pending contacts to call' },
        { status: 400 }
      )
    }

    // Update campaign status to active
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        status: 'active',
        updated_at: new Date().toISOString(),
        metadata: {
          ...campaign.metadata,
          started_at: new Date().toISOString(),
        },
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    // F0254: Log campaign start action to audit log
    await logCampaignAction({
      campaign_id: parseInt(params.id),
      action: 'started',
      actor: user?.email || 'system',
      metadata: {
        pending_contacts: count,
        started_by: user?.email
      },
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Campaign started',
      campaign: data,
      pending_contacts: count,
    })
  } catch (error: any) {
    console.error('Error starting campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to start campaign' },
      { status: 500 }
    )
  }
}
