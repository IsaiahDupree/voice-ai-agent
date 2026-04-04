import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserFromRequest, requireAdmin } from '@/lib/campaign-rbac'
import { logCampaignAction } from '@/lib/campaign-audit'

// F0186: Batch dial stop - Stop/pause an active campaign
// F0253: Campaign RBAC - Only admin can stop campaigns
// F0254: Campaign audit log - Log campaign stop action

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

    if (campaign.status !== 'active') {
      return NextResponse.json(
        { error: 'Campaign is not active' },
        { status: 400 }
      )
    }

    // Update campaign status to paused
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
        metadata: {
          ...campaign.metadata,
          paused_at: new Date().toISOString(),
        },
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    // F0254: Log campaign stop action to audit log
    await logCampaignAction({
      campaign_id: parseInt(params.id),
      action: 'paused',
      actor: user?.email || 'system',
      metadata: {
        paused_by: user?.email,
        previous_status: campaign.status
      },
      timestamp: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Campaign paused',
      campaign: data,
    })
  } catch (error: any) {
    console.error('Error stopping campaign:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to stop campaign' },
      { status: 500 }
    )
  }
}
