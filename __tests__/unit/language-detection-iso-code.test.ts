/**
 * Unit test: Language detection returns correct ISO code
 * Feature 67: Verify language detection helpers return proper ISO 639-1 codes
 *
 * This test verifies:
 * 1. isSupportedLanguage validates ISO codes correctly
 * 2. getLanguageName returns correct language names
 * 3. meetsConfidenceThreshold applies correct logic
 * 4. All supported language codes are valid ISO 639-1 format
 */

import {
  isSupportedLanguage,
  getLanguageName,
  meetsConfidenceThreshold,
  SUPPORTED_LANGUAGES,
  type SupportedLanguageCode,
} from '@/lib/language-detector';

describe('Language Detection: ISO Code Validation', () => {
  describe('isSupportedLanguage', () => {
    it('should return true for all supported ISO 639-1 codes', () => {
      const supportedCodes: SupportedLanguageCode[] = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ja'];

      supportedCodes.forEach((code) => {
        expect(isSupportedLanguage(code)).toBe(true);
      });
    });

    it('should return false for unsupported language codes', () => {
      const unsupportedCodes = ['ru', 'ar', 'ko', 'it', 'pl', 'nl', 'sv'];

      unsupportedCodes.forEach((code) => {
        expect(isSupportedLanguage(code)).toBe(false);
      });
    });

    it('should be case insensitive', () => {
      expect(isSupportedLanguage('EN')).toBe(true);
      expect(isSupportedLanguage('Es')).toBe(true);
      expect(isSupportedLanguage('FR')).toBe(true);
      expect(isSupportedLanguage('eN')).toBe(true);
    });

    it('should return false for invalid codes', () => {
      expect(isSupportedLanguage('')).toBe(false);
      expect(isSupportedLanguage('english')).toBe(false);
      expect(isSupportedLanguage('eng')).toBe(false); // ISO 639-2 code, not 639-1
      expect(isSupportedLanguage('e')).toBe(false);
      expect(isSupportedLanguage('123')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isSupportedLanguage('  en  ')).toBe(false); // Whitespace not handled
      expect(isSupportedLanguage('en-US')).toBe(false); // Locale code, not language code
    });
  });

  describe('getLanguageName', () => {
    it('should return correct names for all supported languages', () => {
      const expectedMappings: Record<SupportedLanguageCode, string> = {
        en: 'English',
        es: 'Spanish',
        fr: 'French',
        de: 'German',
        pt: 'Portuguese',
        zh: 'Chinese',
        hi: 'Hindi',
        ja: 'Japanese',
      };

      Object.entries(expectedMappings).forEach(([code, name]) => {
        expect(getLanguageName(code)).toBe(name);
      });
    });

    it('should be case insensitive', () => {
      expect(getLanguageName('EN')).toBe('English');
      expect(getLanguageName('Es')).toBe('Spanish');
      expect(getLanguageName('FR')).toBe('French');
    });

    it('should return "Unknown" for unsupported codes', () => {
      expect(getLanguageName('ru')).toBe('Unknown');
      expect(getLanguageName('ar')).toBe('Unknown');
      expect(getLanguageName('invalid')).toBe('Unknown');
      expect(getLanguageName('')).toBe('Unknown');
    });
  });

  describe('meetsConfidenceThreshold', () => {
    it('should return true when confidence meets threshold', () => {
      expect(meetsConfidenceThreshold(80, 80)).toBe(true);
      expect(meetsConfidenceThreshold(90, 80)).toBe(true);
      expect(meetsConfidenceThreshold(100, 80)).toBe(true);
    });

    it('should return false when confidence below threshold', () => {
      expect(meetsConfidenceThreshold(79, 80)).toBe(false);
      expect(meetsConfidenceThreshold(50, 80)).toBe(false);
      expect(meetsConfidenceThreshold(0, 80)).toBe(false);
    });

    it('should use default threshold of 80 when not provided', () => {
      expect(meetsConfidenceThreshold(80)).toBe(true);
      expect(meetsConfidenceThreshold(79)).toBe(false);
      expect(meetsConfidenceThreshold(90)).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(meetsConfidenceThreshold(0, 0)).toBe(true);
      expect(meetsConfidenceThreshold(100, 100)).toBe(true);
      expect(meetsConfidenceThreshold(100, 0)).toBe(true);
      expect(meetsConfidenceThreshold(0, 100)).toBe(false);
    });

    it('should handle decimal confidence values', () => {
      expect(meetsConfidenceThreshold(79.9, 80)).toBe(false);
      expect(meetsConfidenceThreshold(80.0, 80)).toBe(true);
      expect(meetsConfidenceThreshold(80.1, 80)).toBe(true);
    });
  });

  describe('SUPPORTED_LANGUAGES constant', () => {
    it('should contain exactly 8 languages', () => {
      expect(Object.keys(SUPPORTED_LANGUAGES)).toHaveLength(8);
    });

    it('should have all codes in lowercase', () => {
      Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
        expect(code).toBe(code.toLowerCase());
      });
    });

    it('should have all codes as 2-character ISO 639-1 format', () => {
      Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
        expect(code).toMatch(/^[a-z]{2}$/);
      });
    });

    it('should have non-empty language names', () => {
      Object.values(SUPPORTED_LANGUAGES).forEach((name) => {
        expect(name).toBeTruthy();
        expect(name.length).toBeGreaterThan(0);
      });
    });

    it('should include all required languages from PRD', () => {
      const requiredLanguages: SupportedLanguageCode[] = [
        'en', // English
        'es', // Spanish
        'fr', // French
        'de', // German
        'pt', // Portuguese
        'zh', // Chinese
        'hi', // Hindi
        'ja', // Japanese
      ];

      requiredLanguages.forEach((code) => {
        expect(SUPPORTED_LANGUAGES).toHaveProperty(code);
      });
    });

    it('should have unique language names', () => {
      const names = Object.values(SUPPORTED_LANGUAGES);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('ISO 639-1 Code Compliance', () => {
    it('should use standard ISO 639-1 codes', () => {
      // Verify that all codes match official ISO 639-1 standard
      const iso6391Codes: Record<SupportedLanguageCode, string> = {
        en: 'English (official ISO 639-1)',
        es: 'Spanish (official ISO 639-1)',
        fr: 'French (official ISO 639-1)',
        de: 'German (official ISO 639-1)',
        pt: 'Portuguese (official ISO 639-1)',
        zh: 'Chinese (official ISO 639-1)',
        hi: 'Hindi (official ISO 639-1)',
        ja: 'Japanese (official ISO 639-1)',
      };

      Object.keys(SUPPORTED_LANGUAGES).forEach((code) => {
        expect(iso6391Codes).toHaveProperty(code);
      });
    });

    it('should not use deprecated or non-standard codes', () => {
      // These are NOT valid ISO 639-1 codes
      const invalidCodes = ['eng', 'spa', 'fra', 'deu', 'por', 'zho', 'hin', 'jpn']; // ISO 639-2

      invalidCodes.forEach((code) => {
        expect(SUPPORTED_LANGUAGES).not.toHaveProperty(code);
      });
    });
  });

  describe('Type Safety', () => {
    it('should enforce SupportedLanguageCode type', () => {
      // This is a compile-time test - TypeScript should enforce the type
      const validCode: SupportedLanguageCode = 'en';
      expect(isSupportedLanguage(validCode)).toBe(true);

      // The following should NOT compile (TypeScript compile error):
      // const invalidCode: SupportedLanguageCode = 'ru';
      // This ensures type safety at compile time
    });

    it('should allow all supported codes in type', () => {
      const codes: SupportedLanguageCode[] = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ja'];

      codes.forEach((code) => {
        expect(SUPPORTED_LANGUAGES[code]).toBeDefined();
      });
    });
  });

  describe('Language Code Lookup Performance', () => {
    it('should perform constant-time lookups for supported languages', () => {
      const iterations = 10000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        isSupportedLanguage('en');
        isSupportedLanguage('es');
        isSupportedLanguage('invalid');
      }

      const elapsed = Date.now() - start;

      // Should complete 30,000 lookups in under 100ms
      expect(elapsed).toBeLessThan(100);
    });
  });

  describe('Case Normalization', () => {
    it('should handle mixed case codes', () => {
      const mixedCaseCodes = ['EN', 'En', 'eN', 'ES', 'Es', 'eS', 'FR', 'Fr', 'fR'];

      mixedCaseCodes.forEach((code) => {
        expect(isSupportedLanguage(code)).toBe(true);
      });
    });

    it('should normalize codes before lookup', () => {
      expect(getLanguageName('EN')).toBe('English');
      expect(getLanguageName('en')).toBe('English');
      expect(getLanguageName('En')).toBe('English');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle null and undefined gracefully', () => {
      expect(isSupportedLanguage(null as unknown as string)).toBe(false);
      expect(isSupportedLanguage(undefined as unknown as string)).toBe(false);
    });

    it('should handle special characters', () => {
      expect(isSupportedLanguage('e@')).toBe(false);
      expect(isSupportedLanguage('!@#')).toBe(false);
      expect(isSupportedLanguage('en-')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isSupportedLanguage('')).toBe(false);
      expect(getLanguageName('')).toBe('Unknown');
    });

    it('should reject whitespace-only strings', () => {
      expect(isSupportedLanguage('  ')).toBe(false);
      expect(isSupportedLanguage('\t')).toBe(false);
      expect(isSupportedLanguage('\n')).toBe(false);
    });
  });

  describe('Confidence Threshold Edge Cases', () => {
    it('should handle negative confidence values', () => {
      expect(meetsConfidenceThreshold(-1, 80)).toBe(false);
      expect(meetsConfidenceThreshold(-100, 80)).toBe(false);
    });

    it('should handle confidence values above 100', () => {
      // Even though confidence shouldn't exceed 100, test defensive behavior
      expect(meetsConfidenceThreshold(150, 80)).toBe(true);
      expect(meetsConfidenceThreshold(200, 150)).toBe(true);
    });

    it('should handle negative thresholds', () => {
      expect(meetsConfidenceThreshold(50, -1)).toBe(true); // Any positive meets negative threshold
      expect(meetsConfidenceThreshold(0, -1)).toBe(true);
    });

    it('should handle extreme threshold values', () => {
      expect(meetsConfidenceThreshold(100, 100)).toBe(true);
      expect(meetsConfidenceThreshold(99.99, 100)).toBe(false);
      expect(meetsConfidenceThreshold(0, 0)).toBe(true);
    });
  });

  describe('Integration with Detection Result Structure', () => {
    it('should provide all required fields for LanguageDetectionResult', () => {
      // This tests the expected structure of detection results
      const mockResult = {
        language: 'es' as SupportedLanguageCode,
        confidence: 95,
        languageName: getLanguageName('es'),
        shouldSwitch: meetsConfidenceThreshold(95, 80) && 'es' !== 'en',
      };

      expect(mockResult.language).toBe('es');
      expect(isSupportedLanguage(mockResult.language)).toBe(true);
      expect(mockResult.languageName).toBe('Spanish');
      expect(mockResult.shouldSwitch).toBe(true);
      expect(mockResult.confidence).toBeGreaterThanOrEqual(0);
      expect(mockResult.confidence).toBeLessThanOrEqual(100);
    });
  });
});
