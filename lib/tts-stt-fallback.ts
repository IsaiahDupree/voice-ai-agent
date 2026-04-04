/**
 * TTS/STT Fallback Handler
 * Handles failures in ElevenLabs TTS and Deepgram STT with fallbacks
 * Features: F1284 (ElevenLabs TTS failure), F1285 (Deepgram STT failure)
 */

import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin;

export interface VoiceConfig {
  provider: 'elevenlabs' | 'vapi_default' | 'playht';
  voiceId?: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
}

export interface TranscriptionConfig {
  provider: 'deepgram' | 'vapi_default' | 'assemblyai';
  model?: string;
  language?: string;
  punctuate?: boolean;
}

/**
 * Get TTS configuration with fallback logic
 */
export async function getTTSConfig(assistantId: string): Promise<VoiceConfig> {
  try {
    // Get assistant's preferred TTS settings
    const { data: assistant } = await supabase
      .from('assistants')
      .select('voice_config, metadata')
      .eq('id', assistantId)
      .single();

    const voiceConfig = assistant?.voice_config || {};
    const useFallback = assistant?.metadata?.tts_fallback_enabled ?? false;

    // Check if ElevenLabs is healthy
    if (voiceConfig.provider === 'elevenlabs') {
      const isHealthy = await checkElevenLabsHealth();

      if (!isHealthy && useFallback) {
        console.warn(`ElevenLabs unhealthy for assistant ${assistantId}, using fallback`);
        await logProviderFailure('elevenlabs', 'tts', assistantId);

        return {
          provider: 'vapi_default',
          voiceId: mapElevenLabsToVapiVoice(voiceConfig.voiceId),
        };
      }
    }

    return voiceConfig;
  } catch (error) {
    console.error('Error getting TTS config:', error);
    // Return safe default
    return {
      provider: 'vapi_default',
    };
  }
}

/**
 * Get STT configuration with fallback logic
 */
export async function getSTTConfig(assistantId: string): Promise<TranscriptionConfig> {
  try {
    // Get assistant's preferred STT settings
    const { data: assistant } = await supabase
      .from('assistants')
      .select('transcription_config, metadata')
      .eq('id', assistantId)
      .single();

    const sttConfig = assistant?.transcription_config || {};
    const useFallback = assistant?.metadata?.stt_fallback_enabled ?? false;

    // Check if Deepgram is healthy
    if (sttConfig.provider === 'deepgram') {
      const isHealthy = await checkDeepgramHealth();

      if (!isHealthy && useFallback) {
        console.warn(`Deepgram unhealthy for assistant ${assistantId}, using fallback`);
        await logProviderFailure('deepgram', 'stt', assistantId);

        return {
          provider: 'vapi_default',
          model: 'nova-2',
          language: sttConfig.language || 'en',
          punctuate: true,
        };
      }
    }

    return sttConfig;
  } catch (error) {
    console.error('Error getting STT config:', error);
    // Return safe default
    return {
      provider: 'vapi_default',
      language: 'en',
      punctuate: true,
    };
  }
}

/**
 * Check ElevenLabs API health
 */
async function checkElevenLabsHealth(): Promise<boolean> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) return false;

    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': apiKey,
      },
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch (error) {
    console.error('ElevenLabs health check failed:', error);
    return false;
  }
}

/**
 * Check Deepgram API health
 */
async function checkDeepgramHealth(): Promise<boolean> {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) return false;

    const response = await fetch('https://api.deepgram.com/v1/projects', {
      headers: {
        'Authorization': `Token ${apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });

    return response.ok;
  } catch (error) {
    console.error('Deepgram health check failed:', error);
    return false;
  }
}

/**
 * Log provider failure for monitoring
 */
async function logProviderFailure(
  provider: string,
  serviceType: 'tts' | 'stt',
  assistantId: string
): Promise<void> {
  const { error } = await supabase.from('provider_failures').insert({
    provider,
    service_type: serviceType,
    assistant_id: assistantId,
    failed_at: new Date().toISOString(),
    metadata: {
      user_agent: 'VoiceAIAgent/1.0',
    },
  });

  if (error) {
    console.error('Failed to log provider failure:', error);
  }
}

/**
 * Map ElevenLabs voice IDs to Vapi default voices
 * This provides a best-effort mapping for fallback
 */
function mapElevenLabsToVapiVoice(elevenLabsVoiceId?: string): string {
  const voiceMap: Record<string, string> = {
    // ElevenLabs Rachel -> Vapi equivalent
    '21m00Tcm4TlvDq8ikWAM': 'jennifer',
    // ElevenLabs Adam -> Vapi equivalent
    'pNInz6obpgDQGcFmaJgB': 'matthew',
    // ElevenLabs Antoni -> Vapi equivalent
    'ErXwobaYiN019PkySvjV': 'christopher',
    // Default fallback
    default: 'en-US-neural-2',
  };

  return voiceMap[elevenLabsVoiceId || ''] || voiceMap.default;
}

/**
 * Get provider failure stats for monitoring
 */
export async function getProviderFailureStats(hours: number = 24): Promise<{
  tts: { total: number; byProvider: Record<string, number> };
  stt: { total: number; byProvider: Record<string, number> };
}> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const { data: failures } = await supabase
    .from('provider_failures')
    .select('provider, service_type')
    .gte('failed_at', since.toISOString());

  const stats = {
    tts: { total: 0, byProvider: {} as Record<string, number> },
    stt: { total: 0, byProvider: {} as Record<string, number> },
  };

  failures?.forEach((f) => {
    if (f.service_type === 'tts') {
      stats.tts.total++;
      stats.tts.byProvider[f.provider] = (stats.tts.byProvider[f.provider] || 0) + 1;
    } else if (f.service_type === 'stt') {
      stats.stt.total++;
      stats.stt.byProvider[f.provider] = (stats.stt.byProvider[f.provider] || 0) + 1;
    }
  });

  return stats;
}

/**
 * Test TTS provider with a sample phrase
 */
export async function testTTSProvider(
  provider: 'elevenlabs' | 'vapi_default',
  config: VoiceConfig
): Promise<{ success: boolean; error?: string; audioUrl?: string }> {
  try {
    if (provider === 'elevenlabs') {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${config.voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': process.env.ELEVENLABS_API_KEY!,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: 'This is a test.',
            model_id: config.model || 'eleven_monolingual_v1',
            voice_settings: {
              stability: config.stability || 0.5,
              similarity_boost: config.similarityBoost || 0.75,
            },
          }),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error(`ElevenLabs API returned ${response.status}`);
      }

      return { success: true };
    }

    // For Vapi default, we just return success as it's always available
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
