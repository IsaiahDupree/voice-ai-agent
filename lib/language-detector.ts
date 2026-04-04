/**
 * Language Detection for Multilingual Voice AI
 *
 * Detects caller's language from transcript snippets and determines
 * whether to switch assistant configuration mid-call.
 *
 * Supported languages: EN, ES, FR, DE, PT, ZH, HI, JA
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface LanguageDetectionResult {
  language: string; // ISO 639-1 code (en, es, fr, de, pt, zh, hi, ja)
  confidence: number; // 0-100
  languageName: string; // English, Spanish, French, etc.
  shouldSwitch: boolean; // true if confidence > threshold and language != en
}

export const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  zh: 'Chinese',
  hi: 'Hindi',
  ja: 'Japanese',
} as const;

export type SupportedLanguageCode = keyof typeof SUPPORTED_LANGUAGES;

const DEFAULT_CONFIDENCE_THRESHOLD = 80;

/**
 * Detect language from transcript snippet using GPT-4o-mini
 *
 * @param text Transcript snippet (first 2-3 sentences recommended)
 * @param confidenceThreshold Minimum confidence to trigger switch (default 80)
 * @param currentLanguage Current assistant language (default 'en')
 * @returns Language detection result with switch recommendation
 */
export async function detectLanguage(
  text: string,
  confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
  currentLanguage: SupportedLanguageCode = 'en'
): Promise<LanguageDetectionResult> {
  if (!text || text.trim().length === 0) {
    return {
      language: 'en',
      confidence: 0,
      languageName: 'English',
      shouldSwitch: false,
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a language detection expert. Analyze the given text and determine the primary language.

Respond ONLY with a JSON object in this exact format:
{
  "language": "ISO 639-1 code (en, es, fr, de, pt, zh, hi, ja)",
  "confidence": number between 0-100,
  "languageName": "Full language name"
}

Supported languages:
- en: English
- es: Spanish (Español)
- fr: French (Français)
- de: German (Deutsch)
- pt: Portuguese (Português)
- zh: Chinese (中文)
- hi: Hindi (हिन्दी)
- ja: Japanese (日本語)

If you detect a language not in this list, return the closest match or default to "en".
Be very confident (>90) only if the text is clearly in that language.
Mixed-language text should return the dominant language with lower confidence (60-80).`,
        },
        {
          role: 'user',
          content: `Detect the language of this text:\n\n${text}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 100,
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    const detectedLanguage = (result.language || 'en').toLowerCase() as SupportedLanguageCode;
    const confidence = Math.min(100, Math.max(0, result.confidence || 0));
    const languageName = result.languageName || SUPPORTED_LANGUAGES[detectedLanguage] || 'English';

    // Determine if we should switch
    const shouldSwitch =
      confidence >= confidenceThreshold &&
      detectedLanguage !== currentLanguage &&
      detectedLanguage in SUPPORTED_LANGUAGES;

    return {
      language: detectedLanguage,
      confidence,
      languageName,
      shouldSwitch,
    };
  } catch (error) {
    console.error('[LanguageDetector] Detection failed:', error);
    // Fallback: no switch on error
    return {
      language: currentLanguage,
      confidence: 0,
      languageName: SUPPORTED_LANGUAGES[currentLanguage],
      shouldSwitch: false,
    };
  }
}

/**
 * Batch detect language from multiple transcript chunks
 * Returns the most confident detection
 */
export async function detectLanguageBatch(
  chunks: string[],
  confidenceThreshold: number = DEFAULT_CONFIDENCE_THRESHOLD,
  currentLanguage: SupportedLanguageCode = 'en'
): Promise<LanguageDetectionResult> {
  if (!chunks || chunks.length === 0) {
    return {
      language: 'en',
      confidence: 0,
      languageName: 'English',
      shouldSwitch: false,
    };
  }

  // Combine chunks (up to 500 chars to keep it fast)
  const combinedText = chunks.join(' ').slice(0, 500);
  return detectLanguage(combinedText, confidenceThreshold, currentLanguage);
}

/**
 * Validate if a language code is supported
 */
export function isSupportedLanguage(code: string): code is SupportedLanguageCode {
  return code.toLowerCase() in SUPPORTED_LANGUAGES;
}

/**
 * Get language name from code
 */
export function getLanguageName(code: string): string {
  const lowerCode = code.toLowerCase() as SupportedLanguageCode;
  return SUPPORTED_LANGUAGES[lowerCode] || 'Unknown';
}

/**
 * Confidence threshold logic
 * High threshold (>80%) ensures we only switch when very confident
 * to avoid false positives from multilingual speakers
 */
export function meetsConfidenceThreshold(
  confidence: number,
  threshold: number = DEFAULT_CONFIDENCE_THRESHOLD
): boolean {
  return confidence >= threshold;
}
