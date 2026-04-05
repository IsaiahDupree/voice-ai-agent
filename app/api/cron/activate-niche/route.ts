export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  try {
    // Authenticate cron request
    if (CRON_SECRET) {
      const authHeader = request.headers.get('authorization')
      const cronHeader = request.headers.get('x-cron-secret')
      const token = cronHeader || authHeader?.replace('Bearer ', '')

      if (token !== CRON_SECRET) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
    }

    const today = new Date()
    const dayOfWeek = today.getDay()
    const todayDate = today.toISOString().split('T')[0]

    // Check for a manual override first
    const { data: override } = await supabaseAdmin
      .from('localreach_niche_overrides')
      .select('*')
      .eq('override_date', todayDate)
      .single()

    let targetNiche: string | null = null
    let targetCampaignId: string | null = null
    let source: 'override' | 'schedule' = 'schedule'

    if (override) {
      targetNiche = override.niche
      targetCampaignId = override.campaign_id
      source = 'override'
    } else {
      // Get today's scheduled niche
      const { data: scheduleEntries } = await supabaseAdmin
        .from('localreach_niche_schedule')
        .select('*')
        .eq('day_of_week', dayOfWeek)
        .order('priority', { ascending: true })
        .limit(1)

      if (scheduleEntries && scheduleEntries.length > 0) {
        targetNiche = scheduleEntries[0].niche
        targetCampaignId = scheduleEntries[0].campaign_id
      }
    }

    if (!targetNiche) {
      return NextResponse.json({
        success: true,
        action: 'none',
        message: `No niche scheduled for ${today.toLocaleDateString('en-US', { weekday: 'long' })}`,
        dayOfWeek,
      })
    }

    // Pause all currently active LocalReach campaigns
    const { data: activeCampaigns } = await supabaseAdmin
      .from('localreach_campaigns')
      .select('id, name, niche')
      .eq('status', 'active')

    if (activeCampaigns && activeCampaigns.length > 0) {
      const activeCampaignIds = activeCampaigns.map((c: any) => c.id)
      await supabaseAdmin
        .from('localreach_campaigns')
        .update({
          status: 'paused',
          paused_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', activeCampaignIds)
    }

    // Activate the target campaign
    let activatedCampaign = null
    if (targetCampaignId) {
      const { data } = await supabaseAdmin
        .from('localreach_campaigns')
        .update({
          status: 'active',
          paused_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetCampaignId)
        .select()
        .single()

      activatedCampaign = data
    } else {
      // Find the first campaign matching this niche
      const { data: matchingCampaign } = await supabaseAdmin
        .from('localreach_campaigns')
        .select('*')
        .eq('niche', targetNiche)
        .neq('status', 'archived')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (matchingCampaign) {
        const { data } = await supabaseAdmin
          .from('localreach_campaigns')
          .update({
            status: 'active',
            paused_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', matchingCampaign.id)
          .select()
          .single()

        activatedCampaign = data
      }
    }

    // Log the niche activation
    await supabaseAdmin.from('localreach_niche_activations').insert({
      date: todayDate,
      day_of_week: dayOfWeek,
      niche: targetNiche,
      campaign_id: activatedCampaign?.id || targetCampaignId,
      source,
      paused_campaigns: activeCampaigns?.map((c: any) => c.id) || [],
      activated_at: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      action: 'activated',
      date: todayDate,
      dayOfWeek,
      source,
      niche: targetNiche,
      activatedCampaign: activatedCampaign
        ? { id: activatedCampaign.id, name: activatedCampaign.name }
        : null,
      pausedCampaigns: activeCampaigns?.length || 0,
    })
  } catch (error: any) {
    console.error('[Activate Niche Cron] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Cron job failed' },
      { status: 500 }
    )
  }
}
