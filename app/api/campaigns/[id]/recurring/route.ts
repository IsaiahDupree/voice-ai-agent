import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0229: Campaign recurring
 * Configure campaigns to run on a recurring schedule (daily, weekly, monthly)
 */

// GET /api/campaigns/:id/recurring
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: campaign, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('id, name, metadata')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    const recurringConfig = campaign.metadata?.recurring || {
      enabled: false,
      frequency: null,
      time: null,
    };

    return NextResponse.json({
      campaign_id: params.id,
      recurring: recurringConfig,
    });
  } catch (error: any) {
    console.error('Error fetching recurring config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch recurring config' },
      { status: 500 }
    );
  }
}

// PUT /api/campaigns/:id/recurring
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { enabled, frequency, time, days_of_week } = body;

    // Validate frequency
    const validFrequencies = ['daily', 'weekly', 'monthly'];
    if (enabled && (!frequency || !validFrequencies.includes(frequency))) {
      return NextResponse.json(
        {
          error: `frequency is required when enabled. Must be one of: ${validFrequencies.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    if (enabled && (!time || !time.match(/^\d{2}:\d{2}$/))) {
      return NextResponse.json(
        { error: 'time is required in HH:MM format when enabled' },
        { status: 400 }
      );
    }

    // Validate days_of_week for weekly frequency
    if (
      frequency === 'weekly' &&
      (!days_of_week || !Array.isArray(days_of_week))
    ) {
      return NextResponse.json(
        { error: 'days_of_week array required for weekly frequency' },
        { status: 400 }
      );
    }

    // Get existing campaign
    const { data: campaign } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('metadata')
      .eq('id', params.id)
      .single();

    // Update with recurring config
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        metadata: {
          ...campaign?.metadata,
          recurring: {
            enabled: enabled !== false,
            frequency,
            time,
            days_of_week: days_of_week || null,
            last_run: null,
            next_run: calculateNextRun(frequency, time, days_of_week),
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
      recurring: data.metadata.recurring,
    });
  } catch (error: any) {
    console.error('Error updating recurring config:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update recurring config' },
      { status: 500 }
    );
  }
}

function calculateNextRun(
  frequency: string,
  time: string,
  daysOfWeek?: number[]
): string | null {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);

  let nextRun = new Date(now);
  nextRun.setHours(hours, minutes, 0, 0);

  // If time has passed today, start from tomorrow
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  if (frequency === 'weekly' && daysOfWeek) {
    // Find next matching day of week
    while (!daysOfWeek.includes(nextRun.getDay())) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  } else if (frequency === 'monthly') {
    // Run on the 1st of next month
    nextRun.setMonth(nextRun.getMonth() + 1);
    nextRun.setDate(1);
  }

  return nextRun.toISOString();
}
