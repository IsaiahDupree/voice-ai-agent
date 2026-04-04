import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

/**
 * F0829: Campaign conversion ranking
 *
 * GET /api/analytics/campaigns/ranking
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('end_date') || new Date().toISOString();

    // Get campaigns
    const { data: campaigns, error: campaignsError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('id, name');

    if (campaignsError) throw campaignsError;

    // Get calls per campaign
    const { data: calls, error: callsError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('campaign_id, outcome, cost_usd')
      .gte('started_at', startDate)
      .lte('started_at', endDate)
      .not('campaign_id', 'is', null);

    if (callsError) throw callsError;

    // Get bookings
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('id, call_id')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    if (bookingsError) throw bookingsError;

    // Build call_id -> campaign_id map
    const callToCampaign: Record<string, string> = {};
    for (const call of calls || []) {
      if (call.campaign_id) {
        callToCampaign[call.campaign_id] = call.campaign_id;
      }
    }

    // Calculate metrics per campaign
    const campaignStats = [];

    for (const campaign of campaigns || []) {
      const campaignCalls = calls?.filter((c) => c.campaign_id === campaign.id) || [];
      const totalCalls = campaignCalls.length;

      const successfulCalls = campaignCalls.filter((c) =>
        ['success', 'completed', 'resolved'].includes(c.outcome)
      ).length;

      const totalCost = campaignCalls.reduce((sum, c) => sum + (Number(c.cost_usd) || 0), 0);

      // Count bookings for this campaign (simplified - would need call_id lookup in production)
      const campaignBookings = 0; // TODO: Implement proper lookup

      const conversionRate = totalCalls > 0 ? (campaignBookings / totalCalls) * 100 : 0;
      const successRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

      campaignStats.push({
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        total_calls: totalCalls,
        successful_calls: successfulCalls,
        success_rate: parseFloat(successRate.toFixed(2)),
        bookings: campaignBookings,
        conversion_rate: parseFloat(conversionRate.toFixed(2)),
        total_cost_usd: parseFloat(totalCost.toFixed(4)),
      });
    }

    // Sort by conversion rate
    campaignStats.sort((a, b) => b.conversion_rate - a.conversion_rate);

    return NextResponse.json({
      campaign_ranking: campaignStats,
      date_range: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error('Error ranking campaigns:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to rank campaigns' },
      { status: 500 }
    );
  }
}
