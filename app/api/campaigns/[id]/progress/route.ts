// F0918: GET /api/campaigns/:id/progress - Returns dialing progress stats
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * GET /api/campaigns/:id/progress
 * F0918: Returns campaign dialing progress statistics
 *
 * Returns:
 * - Total contacts
 * - Completed calls
 * - Pending contacts
 * - Success rate
 * - Average call duration
 * - Calls per hour
 */
export async function GET(
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

    // Get campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Get campaign contacts statistics
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('id, status, attempts, last_attempt_at, last_call_id')
      .eq('campaign_id', campaignId)

    if (contactsError) {
      throw contactsError
    }

    const totalContacts = contacts?.length || 0
    const completedCalls = contacts?.filter(c => c.status === 'completed' || c.status === 'success').length || 0
    const pendingContacts = contacts?.filter(c => c.status === 'pending' || c.status === 'scheduled').length || 0
    const failedContacts = contacts?.filter(c => c.status === 'failed' || c.status === 'exhausted').length || 0
    const inProgress = contacts?.filter(c => c.status === 'calling' || c.status === 'in-progress').length || 0

    // Get call IDs for this campaign
    const callIds = contacts
      ?.filter(c => c.last_call_id)
      .map(c => c.last_call_id)
      .filter(Boolean) || []

    let avgCallDuration = 0
    let successRate = 0
    let callsPerHour = 0

    if (callIds.length > 0) {
      // Get call stats
      const { data: calls, error: callsError } = await supabaseAdmin
        .from('voice_agent_calls')
        .select('duration_seconds, end_reason, started_at')
        .in('call_id', callIds)

      if (!callsError && calls) {
        const completedCallRecords = calls.filter(c => c.duration_seconds > 0)
        avgCallDuration = completedCallRecords.length > 0
          ? Math.round(completedCallRecords.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / completedCallRecords.length)
          : 0

        const successfulCalls = calls.filter(c => c.end_reason === 'completed' || c.end_reason === 'transferred').length
        successRate = calls.length > 0
          ? Math.round((successfulCalls / calls.length) * 100)
          : 0

        // Calculate calls per hour (based on last 24 hours of activity)
        const now = new Date()
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        const recentCalls = calls.filter(c => c.started_at && new Date(c.started_at) > oneDayAgo)
        callsPerHour = recentCalls.length > 0
          ? Math.round(recentCalls.length / 24)
          : 0
      }
    }

    // F0918: Progress object
    const progress = {
      campaignId,
      campaignName: campaign.name,
      campaignStatus: campaign.status,
      totalContacts,
      completedCalls,
      pendingContacts,
      failedContacts,
      inProgress,
      completionRate: totalContacts > 0
        ? Math.round((completedCalls / totalContacts) * 100)
        : 0,
      successRate,
      avgCallDuration,
      callsPerHour,
      startedAt: campaign.created_at,
      lastActivity: contacts && contacts.length > 0
        ? contacts
            .map(c => c.last_attempt_at)
            .filter(Boolean)
            .sort()
            .reverse()[0]
        : null,
    }

    return NextResponse.json(progress)
  } catch (error: any) {
    console.error('[Campaign Progress API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get campaign progress' },
      { status: 500 }
    )
  }
}
