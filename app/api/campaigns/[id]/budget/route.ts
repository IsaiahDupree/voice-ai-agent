import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0245: Campaign budget limit
 * Set and monitor budget limits for campaigns, auto-pause when exhausted
 */

// GET /api/campaigns/:id/budget
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;

    // Get campaign
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('id, name, status, metadata')
      .eq('id', campaignId)
      .single();

    if (campaignError) throw campaignError;

    const budgetConfig = campaign.metadata?.budget || {
      enabled: false,
      limit_usd: null,
      spent_usd: 0,
      alert_threshold: 0.9,
    };

    // Calculate current spend from calls
    const { data: calls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('cost_usd')
      .eq('campaign_id', campaignId)
      .not('cost_usd', 'is', null);

    const totalSpent = calls?.reduce((sum, call) => sum + (Number(call.cost_usd) || 0), 0) || 0;

    const remaining = budgetConfig.limit_usd ? budgetConfig.limit_usd - totalSpent : null;
    const percentUsed = budgetConfig.limit_usd ? (totalSpent / budgetConfig.limit_usd) * 100 : 0;

    return NextResponse.json({
      campaign_id: campaignId,
      campaign_name: campaign.name,
      campaign_status: campaign.status,
      budget: {
        enabled: budgetConfig.enabled,
        limit_usd: budgetConfig.limit_usd,
        spent_usd: parseFloat(totalSpent.toFixed(4)),
        remaining_usd: remaining ? parseFloat(remaining.toFixed(4)) : null,
        percent_used: parseFloat(percentUsed.toFixed(2)),
        alert_threshold: budgetConfig.alert_threshold,
        is_exceeded: remaining !== null && remaining <= 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching campaign budget:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch campaign budget' },
      { status: 500 }
    );
  }
}

// PUT /api/campaigns/:id/budget
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { enabled, limit_usd, alert_threshold } = body;

    if (enabled && (!limit_usd || limit_usd <= 0)) {
      return NextResponse.json(
        { error: 'limit_usd must be > 0 when budget is enabled' },
        { status: 400 }
      );
    }

    // Get existing campaign
    const { data: campaign } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('metadata')
      .eq('id', params.id)
      .single();

    // Update budget config
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        metadata: {
          ...campaign?.metadata,
          budget: {
            enabled: enabled !== false,
            limit_usd: limit_usd || null,
            alert_threshold: alert_threshold || 0.9, // Alert at 90% by default
            updated_at: new Date().toISOString(),
          },
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      campaign_id: params.id,
      budget: data.metadata.budget,
    });
  } catch (error: any) {
    console.error('Error updating campaign budget:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update campaign budget' },
      { status: 500 }
    );
  }
}

// POST /api/campaigns/:id/budget/check
// Check if budget is exhausted and pause campaign if needed
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;

    // Get current budget status (reuse GET logic)
    const statusResponse = await GET(request, { params });
    const statusData = await statusResponse.json();

    if (!statusData.budget.enabled) {
      return NextResponse.json({
        success: true,
        message: 'Budget monitoring not enabled',
        budget_ok: true,
      });
    }

    const isExceeded = statusData.budget.is_exceeded;
    const percentUsed = statusData.budget.percent_used;
    const alertThreshold = statusData.budget.alert_threshold * 100;

    let action = null;

    // Pause campaign if budget exceeded
    if (isExceeded) {
      await supabaseAdmin
        .from('voice_agent_campaigns')
        .update({
          status: 'paused',
          metadata: {
            paused_reason: 'budget_exceeded',
            paused_at: new Date().toISOString(),
          },
        })
        .eq('id', campaignId);

      action = 'paused_campaign';
    }

    return NextResponse.json({
      success: true,
      campaign_id: campaignId,
      budget_ok: !isExceeded,
      alert: percentUsed >= alertThreshold,
      action,
      budget_status: statusData.budget,
    });
  } catch (error: any) {
    console.error('Error checking campaign budget:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check campaign budget' },
      { status: 500 }
    );
  }
}
