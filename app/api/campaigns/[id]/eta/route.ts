import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0211: Campaign ETA estimate
 * GET /api/campaigns/:id/eta
 *
 * Calculates estimated completion time for campaign based on current progress
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id;

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')
      .eq('id', campaignId)
      .single();

    if (campaignError) throw campaignError;

    // Get contact stats
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select('status, last_attempt_at')
      .eq('campaign_id', campaignId);

    if (contactsError) throw contactsError;

    const totalContacts = contacts?.length || 0;
    const completedContacts = contacts?.filter((c) =>
      ['completed', 'success', 'failed', 'dnc'].includes(c.status)
    ).length || 0;
    const pendingContacts = totalContacts - completedContacts;

    // Get recent call rate (calls per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const recentAttempts = contacts?.filter(
      (c) => c.last_attempt_at && c.last_attempt_at > oneHourAgo
    ).length || 0;

    // Calculate calls per hour rate
    const callsPerHour = recentAttempts || 10; // Default to 10 if no recent activity

    // Apply rate limiting from campaign config
    const maxCallsPerDay = campaign.max_calls_per_day || 1000;
    const maxCallsPerHour = Math.min(callsPerHour, maxCallsPerDay / 24);

    // Calculate ETA
    const hoursRemaining = pendingContacts / maxCallsPerHour;
    const etaTimestamp = new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);

    // Calculate daily progress based on calling window
    const callingWindow = campaign.calling_window || { start: '09:00', end: '17:00' };
    const dailyCallingHours = calculateCallingHours(callingWindow);
    const effectiveHoursPerDay = Math.min(dailyCallingHours, 24);
    const daysRemaining = hoursRemaining / effectiveHoursPerDay;

    // Calculate completion percentage
    const completionPercentage = totalContacts > 0
      ? (completedContacts / totalContacts) * 100
      : 0;

    return NextResponse.json({
      campaign_id: campaignId,
      campaign_name: campaign.name,
      total_contacts: totalContacts,
      completed_contacts: completedContacts,
      pending_contacts: pendingContacts,
      completion_percentage: parseFloat(completionPercentage.toFixed(2)),
      current_call_rate: {
        calls_per_hour: maxCallsPerHour,
        calls_per_day: maxCallsPerDay,
      },
      estimated_completion: {
        hours_remaining: parseFloat(hoursRemaining.toFixed(2)),
        days_remaining: parseFloat(daysRemaining.toFixed(2)),
        eta_timestamp: etaTimestamp.toISOString(),
        eta_date: etaTimestamp.toLocaleDateString(),
        eta_time: etaTimestamp.toLocaleTimeString(),
      },
      assumptions: {
        daily_calling_hours: effectiveHoursPerDay,
        calling_window: callingWindow,
      },
    });
  } catch (error: any) {
    console.error('Error calculating campaign ETA:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate ETA' },
      { status: 500 }
    );
  }
}

function calculateCallingHours(window: { start: string; end: string }): number {
  const start = parseTime(window.start);
  const end = parseTime(window.end);
  return Math.max(0, end - start);
}

function parseTime(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours + minutes / 60;
}
