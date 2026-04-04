import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0231: Concurrent campaign limit
 * Enforce maximum number of campaigns running simultaneously
 */

// GET /api/campaigns/concurrency
export async function GET(request: NextRequest) {
  try {
    // Get settings from environment or database
    const maxConcurrent = parseInt(
      process.env.MAX_CONCURRENT_CAMPAIGNS || '5',
      10
    );

    // Count currently running campaigns
    const { data: runningCampaigns, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('id, name, status')
      .eq('status', 'running');

    if (error) throw error;

    const currentCount = runningCampaigns?.length || 0;
    const availableSlots = Math.max(0, maxConcurrent - currentCount);

    // Get queued campaigns
    const { data: queuedCampaigns } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('id, name, metadata')
      .eq('status', 'queued')
      .order('created_at', { ascending: true });

    return NextResponse.json({
      max_concurrent: maxConcurrent,
      current_running: currentCount,
      available_slots: availableSlots,
      at_limit: currentCount >= maxConcurrent,
      running_campaigns: runningCampaigns || [],
      queued_campaigns: queuedCampaigns || [],
    });
  } catch (error: any) {
    console.error('Error fetching concurrency status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch concurrency status' },
      { status: 500 }
    );
  }
}

// POST /api/campaigns/concurrency/enforce
// Enforce concurrency limits and start queued campaigns if slots available
export async function POST(request: NextRequest) {
  try {
    const maxConcurrent = parseInt(
      process.env.MAX_CONCURRENT_CAMPAIGNS || '5',
      10
    );

    // Get current status
    const statusResponse = await GET(request);
    const statusData = await statusResponse.json();

    if (statusData.available_slots <= 0) {
      return NextResponse.json({
        success: true,
        message: 'No available slots, campaigns remain queued',
        slots_available: 0,
      });
    }

    // Start queued campaigns up to available slots
    const campaignsToStart = statusData.queued_campaigns.slice(
      0,
      statusData.available_slots
    );

    const startedCampaigns = [];

    for (const campaign of campaignsToStart) {
      const { data, error } = await supabaseAdmin
        .from('voice_agent_campaigns')
        .update({
          status: 'running',
          metadata: {
            ...campaign.metadata,
            started_from_queue_at: new Date().toISOString(),
          },
        })
        .eq('id', campaign.id)
        .select()
        .single();

      if (!error && data) {
        startedCampaigns.push(data);
      }
    }

    return NextResponse.json({
      success: true,
      started_count: startedCampaigns.length,
      started_campaigns: startedCampaigns,
    });
  } catch (error: any) {
    console.error('Error enforcing concurrency:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to enforce concurrency' },
      { status: 500 }
    );
  }
}
