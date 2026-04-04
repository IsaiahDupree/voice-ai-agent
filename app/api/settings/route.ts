// F0980: GET /api/settings - Returns account settings
// F0981: PUT /api/settings - Updates account settings

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * F0980: GET /api/settings
 * Returns account/organization settings
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id') || 'default'

    // Fetch settings from database
    const { data: settings, error } = await supabaseAdmin
      .from('voice_agent_settings')
      .select('*')
      .eq('org_id', orgId)
      .maybeSingle()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        org_id: orgId,
        settings: getDefaultSettings(),
        message: 'Using default settings',
      })
    }

    return NextResponse.json({
      org_id: orgId,
      settings: settings.settings || getDefaultSettings(),
      updated_at: settings.updated_at,
    })
  } catch (error: any) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    )
  }
}

/**
 * F0981: PUT /api/settings
 * Updates account/organization settings
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { org_id = 'default', settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: 'settings object is required' },
        { status: 400 }
      )
    }

    // Validate settings structure
    const validatedSettings = validateSettings(settings)

    // Upsert settings
    const { data, error } = await supabaseAdmin
      .from('voice_agent_settings')
      .upsert(
        {
          org_id,
          settings: validatedSettings,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'org_id',
        }
      )
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      org_id,
      settings: data.settings,
      updated_at: data.updated_at,
      message: 'Settings updated successfully',
    })
  } catch (error: any) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    )
  }
}

/**
 * Get default settings
 */
function getDefaultSettings() {
  return {
    // Call settings
    call: {
      default_persona_id: null,
      max_call_duration_seconds: 1800, // 30 minutes
      enable_call_recording: true,
      enable_transcription: true,
      enable_sentiment_analysis: true,
    },

    // SMS settings
    sms: {
      enable_sms_followup: true,
      enable_booking_confirmations: true,
      enable_appointment_reminders: true,
      reminder_hours_before: 24,
    },

    // Calendar/Booking settings
    calendar: {
      default_timezone: 'America/New_York',
      default_event_type_id: 1,
      buffer_minutes_before: 15,
      buffer_minutes_after: 15,
      max_advance_booking_days: 90,
    },

    // DNC/Compliance settings
    compliance: {
      respect_dnc_list: true,
      respect_opt_outs: true,
      calling_hours_start: '09:00',
      calling_hours_end: '21:00',
      calling_timezone: 'local',
    },

    // Transfer/Handoff settings
    transfer: {
      enable_transfers: true,
      enable_warm_transfers: true,
      transfer_timeout_seconds: 30,
      transfer_voicemail_enabled: true,
    },

    // Notification settings
    notifications: {
      enable_email_notifications: true,
      enable_webhook_notifications: false,
      webhook_url: null,
      notify_on_booking: true,
      notify_on_transfer: true,
      notify_on_error: true,
    },

    // Dashboard settings
    dashboard: {
      default_date_range: '7d',
      enable_real_time_updates: true,
      show_sentiment_charts: true,
      show_conversion_funnel: true,
    },
  }
}

/**
 * Validate and merge settings with defaults
 */
function validateSettings(settings: any) {
  const defaults = getDefaultSettings()

  // Deep merge user settings with defaults
  return {
    call: { ...defaults.call, ...(settings.call || {}) },
    sms: { ...defaults.sms, ...(settings.sms || {}) },
    calendar: { ...defaults.calendar, ...(settings.calendar || {}) },
    compliance: { ...defaults.compliance, ...(settings.compliance || {}) },
    transfer: { ...defaults.transfer, ...(settings.transfer || {}) },
    notifications: { ...defaults.notifications, ...(settings.notifications || {}) },
    dashboard: { ...defaults.dashboard, ...(settings.dashboard || {}) },
  }
}
