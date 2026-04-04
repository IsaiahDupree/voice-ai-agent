// F0666: Handoff config UI - API backend
// Store and retrieve handoff configuration

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export interface HandoffConfig {
  id?: number
  assistant_id?: string
  triggers_enabled: {
    high_value: boolean
    frustration: boolean
    compliance: boolean
    explicit_request: boolean
    dtmf_zero: boolean // F0679
  }
  transfer_destination: string // Phone number to transfer to
  hold_music_url?: string | null // F0645
  fallback_behavior: 'callback' | 'voicemail' | 'sms' // F0672, F0681
  fallback_sms_template?: string // F0681
  recording_notice_enabled: boolean // F0682
  recording_notice_message?: string
  resume_on_decline: boolean // F0675
  log_transfer_reason: boolean // F0676
  created_at?: string
  updated_at?: string
}

// GET - Retrieve handoff config for an assistant
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const assistantId = searchParams.get('assistant_id')

    if (!assistantId) {
      return NextResponse.json(
        { error: 'assistant_id parameter required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_handoff_config')
      .select('*')
      .eq('assistant_id', assistantId)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found, which is ok
      throw error
    }

    // Return default config if none exists
    if (!data) {
      const defaultConfig: Partial<HandoffConfig> = {
        assistant_id: assistantId,
        triggers_enabled: {
          high_value: true,
          frustration: true,
          compliance: true,
          explicit_request: true,
          dtmf_zero: true,
        },
        transfer_destination: '',
        hold_music_url: null,
        fallback_behavior: 'callback',
        recording_notice_enabled: true,
        recording_notice_message:
          'This call is being recorded for quality and training purposes.',
        resume_on_decline: true,
        log_transfer_reason: true,
      }
      return NextResponse.json(defaultConfig)
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[Handoff Config] GET error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Create or update handoff config
export async function POST(req: NextRequest) {
  try {
    const body: HandoffConfig = await req.json()

    if (!body.assistant_id) {
      return NextResponse.json(
        { error: 'assistant_id is required' },
        { status: 400 }
      )
    }

    // Check if config exists
    const { data: existing } = await supabaseAdmin
      .from('voice_agent_handoff_config')
      .select('id')
      .eq('assistant_id', body.assistant_id)
      .single()

    let result

    if (existing) {
      // Update existing config
      const { data, error } = await supabaseAdmin
        .from('voice_agent_handoff_config')
        .update({
          triggers_enabled: body.triggers_enabled,
          transfer_destination: body.transfer_destination,
          hold_music_url: body.hold_music_url,
          fallback_behavior: body.fallback_behavior,
          fallback_sms_template: body.fallback_sms_template,
          recording_notice_enabled: body.recording_notice_enabled,
          recording_notice_message: body.recording_notice_message,
          resume_on_decline: body.resume_on_decline,
          log_transfer_reason: body.log_transfer_reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      result = data
    } else {
      // Create new config
      const { data, error } = await supabaseAdmin
        .from('voice_agent_handoff_config')
        .insert({
          assistant_id: body.assistant_id,
          triggers_enabled: body.triggers_enabled,
          transfer_destination: body.transfer_destination,
          hold_music_url: body.hold_music_url,
          fallback_behavior: body.fallback_behavior,
          fallback_sms_template: body.fallback_sms_template,
          recording_notice_enabled: body.recording_notice_enabled,
          recording_notice_message: body.recording_notice_message,
          resume_on_decline: body.resume_on_decline,
          log_transfer_reason: body.log_transfer_reason,
        })
        .select()
        .single()

      if (error) throw error
      result = data
    }

    return NextResponse.json({ success: true, config: result })
  } catch (error: any) {
    console.error('[Handoff Config] POST error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
