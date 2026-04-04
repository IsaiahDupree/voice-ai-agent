// F0915: POST /api/campaigns/:id/pause - Pauses campaign
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * POST /api/campaigns/:id/pause
 * F0915: Pauses a running campaign
 *
 * Campaign status becomes 'paused'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = parseInt(params.id)

    if (isNaN(campaignId)) {
      return NextResponse.json(
        { error: 'Invalid campaign ID' },
        { status: 400 }
      )
    }

    // Get current campaign
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Check if campaign is in a pauseable state
    if (campaign.status !== 'active' && campaign.status !== 'running') {
      return NextResponse.json(
        {
          error: 'Campaign must be active or running to pause',
          currentStatus: campaign.status
        },
        { status: 400 }
      )
    }

    // F0915: Update status to 'paused'
    const { data: updatedCampaign, error: updateError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    console.log(`[Campaign] Paused campaign ${campaignId}`)

    return NextResponse.json({
      success: true,
      campaign: updatedCampaign,
    })
  } catch (error: any) {
    console.error('[Campaign Pause API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to pause campaign' },
      { status: 500 }
    )
  }
}
