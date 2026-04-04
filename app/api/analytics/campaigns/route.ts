// F0946: GET /api/analytics/campaigns - Returns campaign analytics
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/analytics/campaigns
 * F0946: Returns campaign-specific analytics
 *
 * Returns:
 * - Campaign performance comparison
 * - Contact reach rates
 * - Campaign completion status
 * - Best performing campaigns
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Get all campaigns
    let campaignQuery = supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')

    if (startDate) {
      campaignQuery = campaignQuery.gte('created_at', startDate)
    }
    if (endDate) {
      campaignQuery = campaignQuery.lte('created_at', endDate)
    }

    const { data: campaigns, error: campaignError } = await campaignQuery

    if (campaignError) {
      throw campaignError
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        totalCampaigns: 0,
        campaigns: [],
        byStatus: {},
      })
    }

    // Get campaign contacts for each campaign
    const campaignAnalytics = await Promise.all(
      campaigns.map(async (campaign) => {
        const { data: contacts } = await supabaseAdmin
          .from('voice_agent_campaign_contacts')
          .select('*')
          .eq('campaign_id', campaign.id)

        const totalContacts = contacts?.length || 0
        const completedCalls = contacts?.filter(c => c.status === 'completed' || c.status === 'success').length || 0
        const pendingContacts = contacts?.filter(c => c.status === 'pending').length || 0
        const failedContacts = contacts?.filter(c => c.status === 'failed').length || 0

        return {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          totalContacts,
          completedCalls,
          pendingContacts,
          failedContacts,
          completionRate: totalContacts > 0
            ? Math.round((completedCalls / totalContacts) * 100)
            : 0,
          successRate: completedCalls > 0
            ? Math.round((completedCalls / (completedCalls + failedContacts)) * 100)
            : 0,
          createdAt: campaign.created_at,
        }
      })
    )

    // Calculate status breakdown
    const byStatus = campaigns.reduce((acc: any, campaign) => {
      acc[campaign.status] = (acc[campaign.status] || 0) + 1
      return acc
    }, {})

    // Sort campaigns by completion rate (best performing first)
    const bestPerforming = [...campaignAnalytics]
      .filter(c => c.totalContacts > 0)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, 10)

    return NextResponse.json({
      totalCampaigns: campaigns.length,
      campaigns: campaignAnalytics,
      byStatus,
      bestPerforming,
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      },
    })
  } catch (error: any) {
    console.error('[Campaign Analytics API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch campaign analytics' },
      { status: 500 }
    )
  }
}
