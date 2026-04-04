/**
 * Unit test: Confidence threshold correctly gates switch
 * Feature 68: Verify confidence threshold logic prevents false switches
 *
 * This test verifies:
 * 1. Switch only occurs when confidence >= threshold
 * 2. Switch is blocked when confidence < threshold
 * 3. Threshold logic works across different threshold values
 * 4. Edge cases (0%, 100%, exact threshold) handled correctly
 */

import { meetsConfidenceThreshold } from '@/lib/language-detector';
import type { LanguageDetectionResult } from '@/lib/language-detector';

describe('Confidence Threshold Gating Logic', () => {
  describe('meetsConfidenceThreshold - Basic Gating', () => {
    it('should allow switch when confidence meets threshold exactly', () => {
      expect(meetsConfidenceThreshold(80, 80)).toBe(true);
      expect(meetsConfidenceThreshold(70, 70)).toBe(true);
      expect(meetsConfidenceThreshold(90, 90)).toBe(true);
    });

    it('should allow switch when confidence exceeds threshold', () => {
      expect(meetsConfidenceThreshold(85, 80)).toBe(true);
      expect(meetsConfidenceThreshold(95, 80)).toBe(true);
      expect(meetsConfidenceThreshold(100, 80)).toBe(true);
      expect(meetsConfidenceThreshold(81, 80)).toBe(true);
    });

    it('should block switch when confidence below threshold', () => {
      expect(meetsConfidenceThreshold(79, 80)).toBe(false);
      expect(meetsConfidenceThreshold(75, 80)).toBe(false);
      expect(meetsConfidenceThreshold(50, 80)).toBe(false);
      expect(meetsConfidenceThreshold(0, 80)).toBe(false);
    });
  });

  describe('Threshold Gating Across Different Thresholds', () => {
    const testCases = [
      { confidence: 95, threshold: 90, expected: true },
      { confidence: 89, threshold: 90, expected: false },
      { confidence: 90, threshold: 90, expected: true },
      { confidence: 85, threshold: 70, expected: true },
      { confidence: 65, threshold: 70, expected: false },
      { confidence: 100, threshold: 95, expected: true },
      { confidence: 94, threshold: 95, expected: false },
      { confidence: 50, threshold: 50, expected: true },
      { confidence: 49, threshold: 50, expected: false },
    ];

    testCases.forEach(({ confidence, threshold, expected }) => {
      it(`should ${expected ? 'allow' : 'block'} switch: confidence=${confidence}, threshold=${threshold}`, () => {
        expect(meetsConfidenceThreshold(confidence, threshold)).toBe(expected);
      });
    });
  });

  describe('Edge Case: 0% and 100% Confidence', () => {
    it('should block switch at 0% confidence with any positive threshold', () => {
      expect(meetsConfidenceThreshold(0, 1)).toBe(false);
      expect(meetsConfidenceThreshold(0, 50)).toBe(false);
      expect(meetsConfidenceThreshold(0, 80)).toBe(false);
      expect(meetsConfidenceThreshold(0, 100)).toBe(false);
    });

    it('should allow switch at 0% confidence with 0% threshold', () => {
      expect(meetsConfidenceThreshold(0, 0)).toBe(true);
    });

    it('should allow switch at 100% confidence with any threshold', () => {
      expect(meetsConfidenceThreshold(100, 0)).toBe(true);
      expect(meetsConfidenceThreshold(100, 50)).toBe(true);
      expect(meetsConfidenceThreshold(100, 80)).toBe(true);
      expect(meetsConfidenceThreshold(100, 100)).toBe(true);
    });
  });

  describe('Decimal Precision Edge Cases', () => {
    it('should handle confidence just below threshold (decimal precision)', () => {
      expect(meetsConfidenceThreshold(79.99, 80)).toBe(false);
      expect(meetsConfidenceThreshold(79.999, 80)).toBe(false);
      expect(meetsConfidenceThreshold(79.9999999, 80)).toBe(false);
    });

    it('should handle confidence at exact threshold (decimal)', () => {
      expect(meetsConfidenceThreshold(80.0, 80)).toBe(true);
      expect(meetsConfidenceThreshold(80.00, 80)).toBe(true);
    });

    it('should handle confidence just above threshold (decimal precision)', () => {
      expect(meetsConfidenceThreshold(80.01, 80)).toBe(true);
      expect(meetsConfidenceThreshold(80.001, 80)).toBe(true);
      expect(meetsConfidenceThreshold(80.0000001, 80)).toBe(true);
    });
  });

  describe('Threshold Prevents False Positives', () => {
    it('should block switch with low confidence even if language detected', () => {
      const lowConfidenceResult: LanguageDetectionResult = {
        language: 'es',
        confidence: 60,
        languageName: 'Spanish',
        shouldSwitch: meetsConfidenceThreshold(60, 80) && 'es' !== 'en',
      };

      expect(lowConfidenceResult.shouldSwitch).toBe(false);
      expect(lowConfidenceResult.language).toBe('es'); // Language detected but switch blocked
    });

    it('should allow switch with high confidence', () => {
      const highConfidenceResult: LanguageDetectionResult = {
        language: 'es',
        confidence: 95,
        languageName: 'Spanish',
        shouldSwitch: meetsConfidenceThreshold(95, 80) && 'es' !== 'en',
      };

      expect(highConfidenceResult.shouldSwitch).toBe(true);
      expect(highConfidenceResult.language).toBe('es');
    });

    it('should block switch when confidence exactly below threshold', () => {
      const result: LanguageDetectionResult = {
        language: 'fr',
        confidence: 79,
        languageName: 'French',
        shouldSwitch: meetsConfidenceThreshold(79, 80) && 'fr' !== 'en',
      };

      expect(result.shouldSwitch).toBe(false);
    });

    it('should allow switch when confidence exactly at threshold', () => {
      const result: LanguageDetectionResult = {
        language: 'de',
        confidence: 80,
        languageName: 'German',
        shouldSwitch: meetsConfidenceThreshold(80, 80) && 'de' !== 'en',
      };

      expect(result.shouldSwitch).toBe(true);
    });
  });

  describe('Multi-Language Gating Scenarios', () => {
    const languages = [
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'zh', name: 'Chinese' },
      { code: 'hi', name: 'Hindi' },
      { code: 'ja', name: 'Japanese' },
    ];

    languages.forEach(({ code, name }) => {
      it(`should gate ${name} switch based on confidence threshold`, () => {
        const lowConfidence: LanguageDetectionResult = {
          language: code,
          confidence: 75,
          languageName: name,
          shouldSwitch: meetsConfidenceThreshold(75, 80) && code !== 'en',
        };

        const highConfidence: LanguageDetectionResult = {
          language: code,
          confidence: 90,
          languageName: name,
          shouldSwitch: meetsConfidenceThreshold(90, 80) && code !== 'en',
        };

        expect(lowConfidence.shouldSwitch).toBe(false);
        expect(highConfidence.shouldSwitch).toBe(true);
      });
    });
  });

  describe('Conservative vs Aggressive Thresholds', () => {
    it('should allow more switches with aggressive (low) threshold', () => {
      const aggressiveThreshold = 70;
      const confidenceValues = [65, 70, 75, 80, 85, 90, 95];

      const allowedSwitches = confidenceValues.filter((conf) =>
        meetsConfidenceThreshold(conf, aggressiveThreshold)
      );

      // With threshold 70: 70, 75, 80, 85, 90, 95 should pass (6 out of 7)
      expect(allowedSwitches).toHaveLength(6);
    });

    it('should block more switches with conservative (high) threshold', () => {
      const conservativeThreshold = 90;
      const confidenceValues = [65, 70, 75, 80, 85, 90, 95];

      const allowedSwitches = confidenceValues.filter((conf) =>
        meetsConfidenceThreshold(conf, conservativeThreshold)
      );

      // With threshold 90: only 90, 95 should pass (2 out of 7)
      expect(allowedSwitches).toHaveLength(2);
    });

    it('should demonstrate threshold impact on false positive rate', () => {
      // Simulate mixed-language confidence values (typically 60-75% for mixed language)
      const mixedLanguageConfidence = 70;

      // Conservative threshold (90%) blocks ambiguous cases
      expect(meetsConfidenceThreshold(mixedLanguageConfidence, 90)).toBe(false);

      // Aggressive threshold (60%) may allow false positives
      expect(meetsConfidenceThreshold(mixedLanguageConfidence, 60)).toBe(true);

      // Balanced threshold (80%) blocks this case
      expect(meetsConfidenceThreshold(mixedLanguageConfidence, 80)).toBe(false);
    });
  });

  describe('Default Threshold Behavior', () => {
    it('should use 80% as default threshold when not specified', () => {
      // meetsConfidenceThreshold(confidence) defaults to threshold=80
      expect(meetsConfidenceThreshold(79)).toBe(false);
      expect(meetsConfidenceThreshold(80)).toBe(true);
      expect(meetsConfidenceThreshold(81)).toBe(true);
    });

    it('should apply default threshold consistently', () => {
      const testConfidences = [50, 60, 70, 79, 80, 85, 90, 95, 100];

      testConfidences.forEach((confidence) => {
        const withDefault = meetsConfidenceThreshold(confidence);
        const withExplicit80 = meetsConfidenceThreshold(confidence, 80);

        expect(withDefault).toBe(withExplicit80);
      });
    });
  });

  describe('Threshold Prevents Spurious Switches', () => {
    it('should block switch for background noise detection', () => {
      // Background noise might trigger low-confidence detection
      const noiseResult: LanguageDetectionResult = {
        language: 'es',
        confidence: 30,
        languageName: 'Spanish',
        shouldSwitch: meetsConfidenceThreshold(30, 80) && 'es' !== 'en',
      };

      expect(noiseResult.shouldSwitch).toBe(false);
    });

    it('should block switch for single-word utterances (low confidence)', () => {
      // Single word might be detected as another language with low confidence
      const singleWordResult: LanguageDetectionResult = {
        language: 'fr',
        confidence: 55,
        languageName: 'French',
        shouldSwitch: meetsConfidenceThreshold(55, 80) && 'fr' !== 'en',
      };

      expect(singleWordResult.shouldSwitch).toBe(false);
    });

    it('should allow switch for clear multi-sentence utterances (high confidence)', () => {
      // Clear multi-sentence utterance in another language
      const clearResult: LanguageDetectionResult = {
        language: 'de',
        confidence: 92,
        languageName: 'German',
        shouldSwitch: meetsConfidenceThreshold(92, 80) && 'de' !== 'en',
      };

      expect(clearResult.shouldSwitch).toBe(true);
    });
  });

  describe('Threshold Stability Across Calls', () => {
    it('should apply threshold consistently across multiple detections', () => {
      const threshold = 80;
      const detections = [
        { confidence: 75, expectedSwitch: false },
        { confidence: 80, expectedSwitch: true },
        { confidence: 85, expectedSwitch: true },
        { confidence: 79, expectedSwitch: false },
        { confidence: 90, expectedSwitch: true },
      ];

      detections.forEach(({ confidence, expectedSwitch }) => {
        const shouldSwitch = meetsConfidenceThreshold(confidence, threshold);
        expect(shouldSwitch).toBe(expectedSwitch);
      });
    });
  });

  describe('Threshold Override Capability', () => {
    it('should allow per-call threshold override', () => {
      const baseConfidence = 75;

      // Default threshold (80%) blocks
      expect(meetsConfidenceThreshold(baseConfidence, 80)).toBe(false);

      // Lower threshold (70%) allows
      expect(meetsConfidenceThreshold(baseConfidence, 70)).toBe(true);

      // Higher threshold (90%) blocks
      expect(meetsConfidenceThreshold(baseConfidence, 90)).toBe(false);
    });

    it('should support tenant-specific thresholds', () => {
      const confidence = 75;

      // Tenant A: conservative (90%)
      const tenantA = meetsConfidenceThreshold(confidence, 90);

      // Tenant B: balanced (80%)
      const tenantB = meetsConfidenceThreshold(confidence, 80);

      // Tenant C: aggressive (70%)
      const tenantC = meetsConfidenceThreshold(confidence, 70);

      expect(tenantA).toBe(false); // Blocked
      expect(tenantB).toBe(false); // Blocked
      expect(tenantC).toBe(true); // Allowed
    });
  });

  describe('Negative and Invalid Threshold Handling', () => {
    it('should treat negative threshold as always passing', () => {
      expect(meetsConfidenceThreshold(0, -1)).toBe(true);
      expect(meetsConfidenceThreshold(50, -10)).toBe(true);
      expect(meetsConfidenceThreshold(100, -100)).toBe(true);
    });

    it('should handle threshold > 100', () => {
      // Threshold > 100 means nothing passes (unless confidence also > 100)
      expect(meetsConfidenceThreshold(100, 101)).toBe(false);
      expect(meetsConfidenceThreshold(99, 101)).toBe(false);

      // Unless confidence somehow exceeds 100 (defensive check)
      expect(meetsConfidenceThreshold(101, 101)).toBe(true);
    });
  });

  describe('Integration with Full Detection Flow', () => {
    it('should demonstrate end-to-end threshold gating', () => {
      // Simulate full detection result processing
      const processDetection = (
        detectedLang: string,
        confidence: number,
        threshold: number,
        currentLang: string
      ): boolean => {
        return (
          meetsConfidenceThreshold(confidence, threshold) &&
          detectedLang !== currentLang &&
          ['en', 'es', 'fr', 'de', 'pt', 'zh', 'hi', 'ja'].includes(detectedLang)
        );
      };

      // High confidence Spanish → switch
      expect(processDetection('es', 90, 80, 'en')).toBe(true);

      // Low confidence Spanish → no switch
      expect(processDetection('es', 70, 80, 'en')).toBe(false);

      // High confidence but already in Spanish → no switch
      expect(processDetection('es', 90, 80, 'es')).toBe(false);

      // Unsupported language → no switch
      expect(processDetection('ru', 90, 80, 'en')).toBe(false);
    });
  });
});
