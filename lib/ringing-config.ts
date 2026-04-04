// F0151: Max ringing duration configuration
// Configure max rings before going to voicemail

import { supabaseAdmin } from './supabase'

export interface RingingConfig {
  assistant_id: string
  max_ring_seconds: number // F0151: Max seconds before voicemail
  voicemail_enabled: boolean
  voicemail_message?: string
  created_at?: string
  updated_at?: string
}

/**
 * F0151: Set max ringing duration for an assistant
 * Default: 30 seconds (approximately 5-6 rings)
 */
export async function setMaxRingingDuration(
  assistantId: string,
  maxRingSeconds: number = 30,
  voicemailMessage?: string
): Promise<void> {
  try {
    const config: Partial<RingingConfig> = {
      assistant_id: assistantId,
      max_ring_seconds: maxRingSeconds,
      voicemail_enabled: true,
      voicemail_message: voicemailMessage,
      updated_at: new Date().toISOString(),
    }

    // Upsert ringing configuration
    await supabaseAdmin
      .from('voice_agent_ringing_config')
      .upsert(config, { onConflict: 'assistant_id' })

    console.log(`Set max ringing duration for ${assistantId}: ${maxRingSeconds}s`)
  } catch (error) {
    console.error('Error setting ringing config:', error)
    throw error
  }
}

/**
 * F0151: Get ringing configuration for assistant
 */
export async function getRingingConfig(assistantId: string): Promise<RingingConfig | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('voice_agent_ringing_config')
      .select('*')
      .eq('assistant_id', assistantId)
      .single()

    if (error) {
      // No config found - return default
      return {
        assistant_id: assistantId,
        max_ring_seconds: 30,
        voicemail_enabled: true,
      }
    }

    return data
  } catch (error) {
    console.error('Error getting ringing config:', error)
    return null
  }
}

/**
 * F0151: Check if call has exceeded max ringing duration
 * Returns true if should go to voicemail
 */
export function shouldGoToVoicemail(
  ringingStartTime: Date,
  maxRingSeconds: number
): boolean {
  const now = new Date()
  const elapsedSeconds = (now.getTime() - ringingStartTime.getTime()) / 1000

  return elapsedSeconds >= maxRingSeconds
}
