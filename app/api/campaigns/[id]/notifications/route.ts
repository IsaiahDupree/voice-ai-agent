import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0218: Campaign start notification
 * F0219: Campaign complete notification
 *
 * Configure email/webhook notifications for campaign lifecycle events
 */

// GET /api/campaigns/:id/notifications
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

    const notifications = campaign.metadata?.notifications || {
      on_start: { enabled: false },
      on_complete: { enabled: false },
      on_milestone: { enabled: false },
    };

    return NextResponse.json({
      campaign_id: params.id,
      notifications,
    });
  } catch (error: any) {
    console.error('Error fetching campaign notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// PUT /api/campaigns/:id/notifications
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { on_start, on_complete, on_milestone } = body;

    // Get existing campaign
    const { data: campaign } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('metadata')
      .eq('id', params.id)
      .single();

    // Build notification config
    const notificationConfig = {
      on_start: on_start || { enabled: false },
      on_complete: on_complete || { enabled: false },
      on_milestone: on_milestone || { enabled: false },
    };

    // Validate email addresses if provided
    const emails = [
      ...(on_start?.emails || []),
      ...(on_complete?.emails || []),
      ...(on_milestone?.emails || []),
    ];

    for (const email of emails) {
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: `Invalid email address: ${email}` },
          { status: 400 }
        );
      }
    }

    // Update campaign
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        metadata: {
          ...campaign?.metadata,
          notifications: notificationConfig,
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
      notifications: data.metadata.notifications,
    });
  } catch (error: any) {
    console.error('Error updating campaign notifications:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update notifications' },
      { status: 500 }
    );
  }
}

// POST /api/campaigns/:id/notifications/test
// Send a test notification
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { event_type } = body; // 'start' or 'complete'

    // Get campaign
    const { data: campaign, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    const notifications = campaign.metadata?.notifications;
    const config =
      event_type === 'start'
        ? notifications?.on_start
        : notifications?.on_complete;

    if (!config || !config.enabled) {
      return NextResponse.json(
        { error: `${event_type} notifications are not enabled` },
        { status: 400 }
      );
    }

    // TODO: Actually send notification (email/webhook)
    // For now, just return success

    return NextResponse.json({
      success: true,
      message: `Test notification sent for ${event_type} event`,
      campaign_id: params.id,
      recipients: config.emails || [],
      webhook: config.webhook || null,
    });
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test notification' },
      { status: 500 }
    );
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Example notification config:
 * {
 *   "on_start": {
 *     "enabled": true,
 *     "emails": ["manager@company.com"],
 *     "webhook": "https://hooks.company.com/campaign-started"
 *   },
 *   "on_complete": {
 *     "enabled": true,
 *     "emails": ["team@company.com"],
 *     "webhook": "https://hooks.company.com/campaign-complete"
 *   },
 *   "on_milestone": {
 *     "enabled": true,
 *     "thresholds": [25, 50, 75],
 *     "emails": ["ops@company.com"]
 *   }
 * }
 */
