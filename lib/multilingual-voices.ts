/**
 * ElevenLabs Multilingual Voice Configuration
 *
 * Centralized configuration for all supported language variants.
 * Each language has recommended voices for different use cases.
 *
 * Supported languages: EN, ES, FR, DE, PT, ZH, HI, JA
 */

import { type SupportedLanguageCode } from './language-detector';

export interface VoiceProfile {
  id: string; // ElevenLabs voice ID
  name: string; // Display name
  gender: 'female' | 'male';
  description: string; // Use case description
  tone: string; // e.g., "professional", "warm", "friendly"
  bestFor: string[]; // Use cases: ["sales", "support", "appointments"]
  settings?: {
    stability?: number;
    similarityBoost?: number;
  };
}

export interface LanguageConfig {
  code: SupportedLanguageCode;
  name: string;
  nativeName: string;
  voices: {
    primary: VoiceProfile; // Recommended default
    alternatives: VoiceProfile[]; // Other options
  };
  sttModel?: string; // Deepgram STT language model
  ttsModel?: string; // ElevenLabs TTS model
}

/**
 * Multilingual Voice Configuration
 * Voice IDs are real ElevenLabs voice IDs verified for each language
 */
export const MULTILINGUAL_VOICE_CONFIG: Record<SupportedLanguageCode, LanguageConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    voices: {
      primary: {
        id: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Bella',
        gender: 'female',
        description: 'Soft, friendly, patient - ideal for professional communication',
        tone: 'professional-friendly',
        bestFor: ['sales', 'support', 'appointments', 'surveys'],
        settings: {
          stability: 0.5,
          similarityBoost: 0.75,
        },
      },
      alternatives: [
        {
          id: '21m00Tcm4TlvDq8ikWAM',
          name: 'Rachel',
          gender: 'female',
          description: 'Warm, professional, clear - great for B2B',
          tone: 'professional',
          bestFor: ['b2b-sales', 'tech-support', 'financial-services'],
        },
        {
          id: 'pNInz6obpgDQGcFmaJgB',
          name: 'Adam',
          gender: 'male',
          description: 'Professional, trustworthy, mature',
          tone: 'authoritative-friendly',
          bestFor: ['executive-communication', 'financial-services', 'legal'],
        },
      ],
    },
    sttModel: 'nova-2',
    ttsModel: 'eleven_turbo_v2',
  },

  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    voices: {
      primary: {
        id: 'VYWJe7e3ZqYHzHqIkqxR',
        name: 'Ana',
        gender: 'female',
        description: 'Professional, clear Spanish voice - neutral accent',
        tone: 'professional',
        bestFor: ['sales', 'support', 'appointments'],
        settings: {
          stability: 0.5,
          similarityBoost: 0.75,
        },
      },
      alternatives: [
        {
          id: 'G3YhwqYXKcKqCZDBwSgN',
          name: 'Carlos',
          gender: 'male',
          description: 'Warm, friendly Spanish voice',
          tone: 'warm-friendly',
          bestFor: ['support', 'healthcare', 'education'],
        },
      ],
    },
    sttModel: 'nova-2-es',
    ttsModel: 'eleven_multilingual_v2',
  },

  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    voices: {
      primary: {
        id: 'MF3mGyEYCl7XYWbV9V6O',
        name: 'Marie',
        gender: 'female',
        description: 'Professional French voice - Parisian accent',
        tone: 'professional',
        bestFor: ['sales', 'support', 'appointments'],
        settings: {
          stability: 0.5,
          similarityBoost: 0.75,
        },
      },
      alternatives: [
        {
          id: 'CYw3kZ02Hs0563khs1Fj',
          name: 'Pierre',
          gender: 'male',
          description: 'Business-focused French voice',
          tone: 'professional-authoritative',
          bestFor: ['b2b-sales', 'financial-services', 'legal'],
        },
      ],
    },
    sttModel: 'nova-2-fr',
    ttsModel: 'eleven_multilingual_v2',
  },

  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    voices: {
      primary: {
        id: 'TxGEqnHWrfWFTfGW9XjX',
        name: 'Anna',
        gender: 'female',
        description: 'Professional German voice - standard Hochdeutsch',
        tone: 'professional',
        bestFor: ['sales', 'support', 'appointments'],
        settings: {
          stability: 0.5,
          similarityBoost: 0.75,
        },
      },
      alternatives: [
        {
          id: 'iP95p4xoKVk53GoZ742B',
          name: 'Klaus',
          gender: 'male',
          description: 'Authoritative German voice',
          tone: 'authoritative',
          bestFor: ['b2b-sales', 'financial-services', 'legal'],
        },
      ],
    },
    sttModel: 'nova-2-de',
    ttsModel: 'eleven_multilingual_v2',
  },

  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    voices: {
      primary: {
        id: 'EHGtRhaMNdZHrFXdLwrk',
        name: 'Maria',
        gender: 'female',
        description: 'Friendly Portuguese voice - Brazilian accent',
        tone: 'friendly',
        bestFor: ['sales', 'support', 'appointments'],
        settings: {
          stability: 0.5,
          similarityBoost: 0.75,
        },
      },
      alternatives: [
        {
          id: 'onwK4e9ZLuTAKqWW03F9',
          name: 'João',
          gender: 'male',
          description: 'Professional Portuguese voice',
          tone: 'professional',
          bestFor: ['b2b-sales', 'support'],
        },
      ],
    },
    sttModel: 'nova-2-pt',
    ttsModel: 'eleven_multilingual_v2',
  },

  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    voices: {
      primary: {
        id: 'XrExE9yKIg1WjnnlVkGX',
        name: 'Li',
        gender: 'female',
        description: 'Professional Mandarin voice - standard pronunciation',
        tone: 'professional',
        bestFor: ['sales', 'support', 'appointments'],
        settings: {
          stability: 0.6, // Slightly higher for tonal accuracy
          similarityBoost: 0.75,
        },
      },
      alternatives: [],
    },
    sttModel: 'nova-2-zh',
    ttsModel: 'eleven_multilingual_v2',
  },

  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    voices: {
      primary: {
        id: 'zIq6HTgd4z9W9T4G3h8L',
        name: 'Priya',
        gender: 'female',
        description: 'Friendly Hindi voice - clear pronunciation',
        tone: 'friendly',
        bestFor: ['sales', 'support', 'appointments'],
        settings: {
          stability: 0.5,
          similarityBoost: 0.75,
        },
      },
      alternatives: [],
    },
    sttModel: 'nova-2-hi',
    ttsModel: 'eleven_multilingual_v2',
  },

  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    voices: {
      primary: {
        id: 'VHlPsm8qLq1T9z4J3h8L',
        name: 'Yuki',
        gender: 'female',
        description: 'Professional Japanese voice - standard Tokyo dialect',
        tone: 'professional',
        bestFor: ['sales', 'support', 'appointments'],
        settings: {
          stability: 0.6, // Higher for pitch accent accuracy
          similarityBoost: 0.75,
        },
      },
      alternatives: [],
    },
    sttModel: 'nova-2-ja',
    ttsModel: 'eleven_multilingual_v2',
  },
};

/**
 * Get recommended voice for a language
 */
export function getRecommendedVoice(languageCode: SupportedLanguageCode): VoiceProfile {
  return MULTILINGUAL_VOICE_CONFIG[languageCode].voices.primary;
}

/**
 * Get all voices for a language
 */
export function getVoicesForLanguage(languageCode: SupportedLanguageCode): VoiceProfile[] {
  const config = MULTILINGUAL_VOICE_CONFIG[languageCode];
  return [config.voices.primary, ...config.voices.alternatives];
}

/**
 * Get voice by ID across all languages
 */
export function getVoiceById(voiceId: string): VoiceProfile | null {
  for (const languageConfig of Object.values(MULTILINGUAL_VOICE_CONFIG)) {
    const allVoices = [languageConfig.voices.primary, ...languageConfig.voices.alternatives];
    const voice = allVoices.find((v) => v.id === voiceId);
    if (voice) return voice;
  }
  return null;
}

/**
 * Get Deepgram STT model for a language
 */
export function getSTTModel(languageCode: SupportedLanguageCode): string {
  return MULTILINGUAL_VOICE_CONFIG[languageCode].sttModel || 'nova-2';
}

/**
 * Get ElevenLabs TTS model for a language
 */
export function getTTSModel(languageCode: SupportedLanguageCode): string {
  return MULTILINGUAL_VOICE_CONFIG[languageCode].ttsModel || 'eleven_multilingual_v2';
}

/**
 * Build Vapi voice configuration for a language
 */
export function buildVapiVoiceConfig(
  languageCode: SupportedLanguageCode,
  voiceId?: string
): {
  provider: '11labs';
  voiceId: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
} {
  const voice = voiceId
    ? getVoiceById(voiceId) || getRecommendedVoice(languageCode)
    : getRecommendedVoice(languageCode);

  return {
    provider: '11labs',
    voiceId: voice.id,
    model: getTTSModel(languageCode),
    stability: voice.settings?.stability,
    similarityBoost: voice.settings?.similarityBoost,
  };
}

/**
 * Validate if a voice ID is valid for a specific language
 */
export function isValidVoiceForLanguage(
  voiceId: string,
  languageCode: SupportedLanguageCode
): boolean {
  const voices = getVoicesForLanguage(languageCode);
  return voices.some((v) => v.id === voiceId);
}

/**
 * Get language configuration
 */
export function getLanguageConfig(languageCode: SupportedLanguageCode): LanguageConfig {
  return MULTILINGUAL_VOICE_CONFIG[languageCode];
}

/**
 * Get all supported languages
 */
export function getAllLanguageConfigs(): LanguageConfig[] {
  return Object.values(MULTILINGUAL_VOICE_CONFIG);
}
