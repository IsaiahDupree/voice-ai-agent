// F0487: Deepgram configuration with smart_format enabled

export interface DeepgramConfig {
  model?: string
  language?: string
  smart_format?: boolean // F0487: Auto-format numbers, dates, currency
  punctuate?: boolean
  diarize?: boolean
  interim_results?: boolean
  endpointing?: number
  vad_events?: boolean
}

/**
 * F0487: Default Deepgram configuration for Vapi assistant
 * Enables smart_format for automatic formatting of:
 * - Numbers (e.g., "one hundred" → "100")
 * - Dates (e.g., "march twenty sixth" → "March 26th")
 * - Currency (e.g., "fifty dollars" → "$50")
 * - Times (e.g., "three thirty pm" → "3:30 PM")
 */
export const defaultDeepgramConfig: DeepgramConfig = {
  model: 'nova-2-general', // Latest Deepgram model
  language: 'en-US',
  smart_format: true, // F0487: Enable smart formatting
  punctuate: true, // Auto-punctuation
  diarize: true, // Speaker diarization
  interim_results: true, // Real-time partial results (F0461)
  endpointing: 300, // 300ms silence to detect end of speech
  vad_events: true, // Voice activity detection
}

/**
 * F0483: Deepgram model selection based on use case
 */
export function selectDeepgramModel(useCase: 'general' | 'phone' | 'voicemail' | 'meeting'): string {
  switch (useCase) {
    case 'phone':
      return 'nova-2-phonecall' // Optimized for phone calls
    case 'voicemail':
      return 'nova-2-voicemail' // Optimized for voicemail
    case 'meeting':
      return 'nova-2-meeting' // Optimized for meetings
    case 'general':
    default:
      return 'nova-2-general' // General purpose
  }
}

/**
 * Build Deepgram transcriber config for Vapi assistant
 */
export function buildDeepgramTranscriberConfig(options?: {
  useCase?: 'general' | 'phone' | 'voicemail' | 'meeting'
  smartFormat?: boolean
  diarize?: boolean
}): {
  provider: 'deepgram'
  model: string
  language: string
  smartFormat: boolean
  keywords?: string[]
} {
  const { useCase = 'phone', smartFormat = true, diarize = true } = options || {}

  return {
    provider: 'deepgram',
    model: selectDeepgramModel(useCase), // F0483
    language: 'en-US',
    smartFormat, // F0487
    keywords: [
      'appointment',
      'booking',
      'schedule',
      'calendar',
      'confirmed',
      'cancelled',
    ], // Boost recognition of common words
  }
}
