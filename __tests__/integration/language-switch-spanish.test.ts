/**
 * Integration test: Spanish transcript → language switch triggered
 * Feature 66: Verify Spanish language detection triggers assistant switch
 *
 * This test verifies:
 * 1. Language detector correctly identifies Spanish from transcript
 * 2. Confidence score meets threshold (>80%)
 * 3. shouldSwitch flag is set to true
 * 4. API endpoint returns proper response structure
 */

import { detectLanguage, detectLanguageBatch } from '@/lib/language-detector';

describe('Language Switch: Spanish Detection Integration', () => {
  const spanishSamples = {
    greeting: '¡Hola! ¿Cómo estás? Me llamo María.',
    business: 'Buenos días, quisiera hacer una cita para el próximo martes.',
    customer: 'Tengo una pregunta sobre mi cuenta. ¿Puede ayudarme?',
    mixed: 'Hola, I need help con mi reservación.',
  };

  describe('Direct Language Detection', () => {
    it('should detect Spanish from greeting with high confidence', async () => {
      const result = await detectLanguage(spanishSamples.greeting, 80, 'en');

      expect(result.language).toBe('es');
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.shouldSwitch).toBe(true);
      expect(result.languageName.toLowerCase()).toContain('spanish');
    }, 10000); // 10s timeout for OpenAI API

    it('should detect Spanish from business context', async () => {
      const result = await detectLanguage(spanishSamples.business, 80, 'en');

      expect(result.language).toBe('es');
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.shouldSwitch).toBe(true);
    }, 10000);

    it('should detect Spanish from customer service context', async () => {
      const result = await detectLanguage(spanishSamples.customer, 80, 'en');

      expect(result.language).toBe('es');
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.shouldSwitch).toBe(true);
    }, 10000);

    it('should handle mixed language with moderate confidence', async () => {
      const result = await detectLanguage(spanishSamples.mixed, 80, 'en');

      // Mixed language should still detect Spanish or English
      expect(['es', 'en']).toContain(result.language);

      // May have lower confidence due to mixing
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    }, 10000);

    it('should not switch when already in Spanish', async () => {
      const result = await detectLanguage(spanishSamples.greeting, 80, 'es');

      expect(result.language).toBe('es');
      expect(result.shouldSwitch).toBe(false); // Already in Spanish
    }, 10000);

    it('should not switch with low confidence threshold', async () => {
      const result = await detectLanguage(spanishSamples.greeting, 95, 'en');

      expect(result.language).toBe('es');

      // May not meet 95% threshold depending on GPT confidence
      // shouldSwitch depends on confidence vs threshold
      if (result.confidence >= 95) {
        expect(result.shouldSwitch).toBe(true);
      } else {
        expect(result.shouldSwitch).toBe(false);
      }
    }, 10000);
  });

  describe('Batch Language Detection', () => {
    it('should detect Spanish from multiple transcript chunks', async () => {
      const chunks = [
        '¡Hola!',
        '¿Cómo estás?',
        'Me llamo María.',
        'Necesito ayuda con mi reserva.',
      ];

      const result = await detectLanguageBatch(chunks, 80, 'en');

      expect(result.language).toBe('es');
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.shouldSwitch).toBe(true);
    }, 10000);

    it('should handle empty chunks gracefully', async () => {
      const result = await detectLanguageBatch([], 80, 'en');

      expect(result.language).toBe('en');
      expect(result.confidence).toBe(0);
      expect(result.shouldSwitch).toBe(false);
    });

    it('should handle single-word chunks', async () => {
      const chunks = ['Hola', 'Gracias', 'Sí'];

      const result = await detectLanguageBatch(chunks, 80, 'en');

      expect(result.language).toBe('es');
      expect(result.shouldSwitch).toBe(true);
    }, 10000);
  });

  describe('Confidence Threshold Behavior', () => {
    it('should respect custom confidence thresholds', async () => {
      const thresholds = [70, 80, 90];

      for (const threshold of thresholds) {
        const result = await detectLanguage(spanishSamples.greeting, threshold, 'en');

        expect(result.language).toBe('es');

        // shouldSwitch should be true only if confidence >= threshold
        if (result.confidence >= threshold) {
          expect(result.shouldSwitch).toBe(true);
        } else {
          expect(result.shouldSwitch).toBe(false);
        }
      }
    }, 30000); // Longer timeout for multiple API calls
  });

  describe('Edge Cases', () => {
    it('should handle empty text', async () => {
      const result = await detectLanguage('', 80, 'en');

      expect(result.language).toBe('en');
      expect(result.confidence).toBe(0);
      expect(result.shouldSwitch).toBe(false);
    });

    it('should handle whitespace-only text', async () => {
      const result = await detectLanguage('   \n\t  ', 80, 'en');

      expect(result.language).toBe('en');
      expect(result.confidence).toBe(0);
      expect(result.shouldSwitch).toBe(false);
    });

    it('should handle very short Spanish text', async () => {
      const result = await detectLanguage('Sí', 80, 'en');

      expect(result.language).toBe('es');
      // Short text may have lower confidence
      expect(result.confidence).toBeGreaterThan(0);
    }, 10000);

    it('should handle numbers and punctuation', async () => {
      const result = await detectLanguage('123 !!! ??? ---', 80, 'en');

      // Should default to English or have low confidence
      expect(['en', 'es']).toContain(result.language);
      expect(result.shouldSwitch).toBe(false);
    }, 10000);
  });

  describe('Real-World Call Scenarios', () => {
    it('should detect Spanish in first 2-3 seconds of call', async () => {
      // Simulate first transcript chunks from a Spanish speaker
      const firstChunks = [
        '¿Hola?',
        'Sí, buenos días.',
        'Estoy llamando para hacer una cita.',
      ];

      const result = await detectLanguageBatch(firstChunks, 80, 'en');

      expect(result.language).toBe('es');
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.shouldSwitch).toBe(true);
    }, 10000);

    it('should handle caller answering in Spanish to English greeting', async () => {
      // Agent says "Hello" in English, caller responds in Spanish
      const callerResponse = 'Hola, ¿hablas español?';

      const result = await detectLanguage(callerResponse, 80, 'en');

      expect(result.language).toBe('es');
      expect(result.shouldSwitch).toBe(true);
    }, 10000);

    it('should detect Spanish accent indicators', async () => {
      // Spanish with accent marks and special characters
      const textWithAccents = '¡Hola! Estoy aquí. ¿Puedes ayudarme mañana?';

      const result = await detectLanguage(textWithAccents, 80, 'en');

      expect(result.language).toBe('es');
      expect(result.confidence).toBeGreaterThan(80);
      expect(result.shouldSwitch).toBe(true);
    }, 10000);
  });

  describe('API Error Handling', () => {
    it('should handle detection failures gracefully', async () => {
      // This tests the error handling in language-detector.ts
      // If OpenAI API fails, it should return safe defaults

      const result = await detectLanguage('Test text', 80, 'en');

      // Even if API fails, should return valid structure
      expect(result).toHaveProperty('language');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('shouldSwitch');
      expect(result).toHaveProperty('languageName');
    }, 10000);
  });
});

describe('Language Detection API Endpoint', () => {
  const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  describe('POST /api/language/detect', () => {
    it('should detect Spanish via API endpoint', async () => {
      const response = await fetch(`${API_BASE}/api/language/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: '¡Hola! ¿Cómo estás?',
          confidenceThreshold: 80,
          currentLanguage: 'en',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.language).toBe('es');
      expect(data.data.confidence).toBeGreaterThan(80);
      expect(data.data.shouldSwitch).toBe(true);
      expect(data.meta.threshold).toBe(80);
      expect(data.meta.currentLanguage).toBe('en');
    }, 15000);

    it('should handle batch detection via API', async () => {
      const response = await fetch(`${API_BASE}/api/language/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunks: ['Hola', '¿Cómo estás?', 'Necesito ayuda'],
          confidenceThreshold: 80,
          currentLanguage: 'en',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.language).toBe('es');
      expect(data.data.shouldSwitch).toBe(true);
    }, 15000);

    it('should validate input parameters', async () => {
      const response = await fetch(`${API_BASE}/api/language/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required field');
    });

    it('should validate confidence threshold range', async () => {
      const response = await fetch(`${API_BASE}/api/language/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Test',
          confidenceThreshold: 150, // Invalid: > 100
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('confidenceThreshold');
    });

    it('should validate language code', async () => {
      const response = await fetch(`${API_BASE}/api/language/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'Test',
          currentLanguage: 'invalid', // Not supported
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain('Unsupported language code');
    });
  });

  describe('GET /api/language/detect (Health Check)', () => {
    it('should return health status', async () => {
      const response = await fetch(`${API_BASE}/api/language/detect`);

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.status).toBe('healthy');
      expect(data.service).toBe('language-detection');
      expect(data.supportedLanguages).toContain('es');
      expect(data.supportedLanguages).toHaveLength(8);
    }, 15000);
  });
});
