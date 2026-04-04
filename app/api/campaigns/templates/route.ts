import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * F0222: Campaign template
 * Predefined campaign templates for common use cases
 */

const CAMPAIGN_TEMPLATES = [
  {
    id: 'sales_outreach',
    name: 'Sales Outreach',
    description: 'Cold outreach campaign for lead generation',
    settings: {
      calling_window: { start: '09:00', end: '17:00', timezone: 'America/New_York' },
      max_calls_per_day: 100,
      retry_config: {
        max_attempts: 3,
        wait_hours: 48,
      },
      voicemail_message: 'Hi, this is [Agent Name] from [Company]. I wanted to discuss how we can help [Value Prop]. Please call me back at [Number].',
    },
  },
  {
    id: 'appointment_reminder',
    name: 'Appointment Reminder',
    description: 'Automated appointment reminders',
    settings: {
      calling_window: { start: '10:00', end: '18:00', timezone: 'America/New_York' },
      max_calls_per_day: 500,
      retry_config: {
        max_attempts: 2,
        wait_hours: 4,
      },
      voicemail_message: 'This is a reminder about your upcoming appointment on [Date] at [Time]. Please call [Number] if you need to reschedule.',
    },
  },
  {
    id: 'customer_survey',
    name: 'Customer Survey',
    description: 'Post-purchase or service feedback collection',
    settings: {
      calling_window: { start: '11:00', end: '19:00', timezone: 'America/New_York' },
      max_calls_per_day: 200,
      retry_config: {
        max_attempts: 2,
        wait_hours: 24,
      },
      voicemail_message: 'We value your feedback! This is [Agent] from [Company] calling to hear about your recent experience. Call us back at [Number].',
    },
  },
  {
    id: 'payment_reminder',
    name: 'Payment Reminder',
    description: 'Friendly payment collection calls',
    settings: {
      calling_window: { start: '09:00', end: '20:00', timezone: 'America/New_York' },
      max_calls_per_day: 150,
      retry_config: {
        max_attempts: 5,
        wait_hours: 72,
      },
      voicemail_message: 'This is a reminder about an outstanding balance on your account. Please contact us at [Number] to discuss payment options.',
    },
  },
  {
    id: 'event_invitation',
    name: 'Event Invitation',
    description: 'Webinar or event invitation calls',
    settings: {
      calling_window: { start: '10:00', end: '17:00', timezone: 'America/New_York' },
      max_calls_per_day: 300,
      retry_config: {
        max_attempts: 2,
        wait_hours: 48,
      },
      voicemail_message: 'You\'re invited to our upcoming [Event Name] on [Date]. Call [Number] or visit [URL] to register.',
    },
  },
];

// GET /api/campaigns/templates - List all templates
export async function GET(request: NextRequest) {
  return NextResponse.json({
    templates: CAMPAIGN_TEMPLATES,
    count: CAMPAIGN_TEMPLATES.length,
  });
}

// POST /api/campaigns/templates/:template_id - Create campaign from template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { template_id, name, assistant_id, customizations } = body;

    if (!template_id || !name || !assistant_id) {
      return NextResponse.json(
        { error: 'template_id, name, and assistant_id are required' },
        { status: 400 }
      );
    }

    // Find template
    const template = CAMPAIGN_TEMPLATES.find((t) => t.id === template_id);

    if (!template) {
      return NextResponse.json(
        {
          error: `Template not found. Available: ${CAMPAIGN_TEMPLATES.map((t) => t.id).join(', ')}`,
        },
        { status: 404 }
      );
    }

    // Merge template settings with customizations
    const campaignSettings = {
      ...template.settings,
      ...customizations,
    };

    // Create campaign
    const { data: campaign, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .insert({
        name,
        assistant_id,
        status: 'draft',
        calling_window: campaignSettings.calling_window,
        max_calls_per_day: campaignSettings.max_calls_per_day,
        voicemail_message: campaignSettings.voicemail_message,
        metadata: {
          template_id,
          template_name: template.name,
          retry_config: campaignSettings.retry_config,
          created_from_template: true,
        },
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      campaign,
      template_used: {
        id: template.id,
        name: template.name,
        description: template.description,
      },
    });
  } catch (error: any) {
    console.error('Error creating campaign from template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create campaign from template' },
      { status: 500 }
    );
  }
}
