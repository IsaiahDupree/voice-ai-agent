/**
 * Integration test: PIN validation rejects invalid format
 * Feature 84: Verify DTMF input validation for PINs and account numbers
 *
 * This test verifies:
 * 1. PIN validation accepts valid formats (4-8 digits)
 * 2. Rejects invalid formats (too short, too long, non-numeric)
 * 3. Account number validation works correctly
 * 4. Confirmation input validation (1=yes, 2=no)
 */

import { DTMFRouter } from '@/lib/dtmf-router';

describe('DTMF PIN Validation', () => {
  describe('DTMFRouter.validateInput - PIN validation', () => {
    it('should accept valid 4-digit PIN', () => {
      const result = DTMFRouter.validateInput('1234', 'pin');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid 6-digit PIN', () => {
      const result = DTMFRouter.validateInput('123456', 'pin');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid 8-digit PIN', () => {
      const result = DTMFRouter.validateInput('12345678', 'pin');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject PIN with less than 4 digits', () => {
      const result = DTMFRouter.validateInput('123', 'pin');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid PIN format');
    });

    it('should reject PIN with more than 8 digits', () => {
      const result = DTMFRouter.validateInput('123456789', 'pin');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid PIN format');
    });

    it('should reject PIN with non-numeric characters', () => {
      const result = DTMFRouter.validateInput('12a4', 'pin');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input must contain only digits');
    });

    it('should reject PIN with special characters', () => {
      const result = DTMFRouter.validateInput('12-34', 'pin');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input must contain only digits');
    });

    it('should reject empty PIN', () => {
      const result = DTMFRouter.validateInput('', 'pin');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid PIN format');
    });

    it('should reject PIN with spaces', () => {
      const result = DTMFRouter.validateInput('12 34', 'pin');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input must contain only digits');
    });
  });

  describe('DTMFRouter.validateInput - Account number validation', () => {
    it('should accept valid 8-digit account number', () => {
      const result = DTMFRouter.validateInput('12345678', 'account_number');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid 12-digit account number', () => {
      const result = DTMFRouter.validateInput('123456789012', 'account_number');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept valid 16-digit account number', () => {
      const result = DTMFRouter.validateInput('1234567890123456', 'account_number');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject account number with less than 8 digits', () => {
      const result = DTMFRouter.validateInput('1234567', 'account_number');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid account number format');
    });

    it('should reject account number with more than 16 digits', () => {
      const result = DTMFRouter.validateInput('12345678901234567', 'account_number');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid account number format');
    });

    it('should reject account number with non-numeric characters', () => {
      const result = DTMFRouter.validateInput('1234567A', 'account_number');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input must contain only digits');
    });
  });

  describe('DTMFRouter.validateInput - Confirmation validation', () => {
    it('should accept "1" for confirmation (yes)', () => {
      const result = DTMFRouter.validateInput('1', 'confirmation');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept "2" for confirmation (no)', () => {
      const result = DTMFRouter.validateInput('2', 'confirmation');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject "3" for confirmation', () => {
      const result = DTMFRouter.validateInput('3', 'confirmation');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Press 1 to confirm or 2 to cancel');
    });

    it('should reject multi-digit confirmation', () => {
      const result = DTMFRouter.validateInput('11', 'confirmation');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Press 1 to confirm or 2 to cancel');
    });

    it('should reject empty confirmation', () => {
      const result = DTMFRouter.validateInput('', 'confirmation');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Press 1 to confirm or 2 to cancel');
    });
  });

  describe('DTMFRouter.validateInput - Numeric (generic) validation', () => {
    it('should accept any numeric input', () => {
      const result = DTMFRouter.validateInput('12345', 'numeric');

      expect(result.valid).toBe(true);
    });

    it('should reject non-numeric input', () => {
      const result = DTMFRouter.validateInput('abc', 'numeric');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input must contain only digits');
    });
  });

  describe('DTMFRouter.validateInput - Length constraints', () => {
    it('should enforce exact length when specified', () => {
      const validResult = DTMFRouter.validateInput('12345', 'numeric', { length: 5 });
      expect(validResult.valid).toBe(true);

      const tooShort = DTMFRouter.validateInput('1234', 'numeric', { length: 5 });
      expect(tooShort.valid).toBe(false);
      expect(tooShort.error).toBe('Input must be exactly 5 digits');

      const tooLong = DTMFRouter.validateInput('123456', 'numeric', { length: 5 });
      expect(tooLong.valid).toBe(false);
      expect(tooLong.error).toBe('Input must be exactly 5 digits');
    });

    it('should enforce minimum length when specified', () => {
      const validResult = DTMFRouter.validateInput('12345', 'numeric', { min_length: 3 });
      expect(validResult.valid).toBe(true);

      const tooShort = DTMFRouter.validateInput('12', 'numeric', { min_length: 3 });
      expect(tooShort.valid).toBe(false);
      expect(tooShort.error).toBe('Input must be at least 3 digits');
    });

    it('should enforce maximum length when specified', () => {
      const validResult = DTMFRouter.validateInput('12345', 'numeric', { max_length: 10 });
      expect(validResult.valid).toBe(true);

      const tooLong = DTMFRouter.validateInput('12345678901', 'numeric', { max_length: 10 });
      expect(tooLong.valid).toBe(false);
      expect(tooLong.error).toBe('Input must be at most 10 digits');
    });

    it('should enforce min and max length together', () => {
      const validResult = DTMFRouter.validateInput('12345', 'numeric', {
        min_length: 3,
        max_length: 10,
      });
      expect(validResult.valid).toBe(true);

      const tooShort = DTMFRouter.validateInput('12', 'numeric', {
        min_length: 3,
        max_length: 10,
      });
      expect(tooShort.valid).toBe(false);

      const tooLong = DTMFRouter.validateInput('12345678901', 'numeric', {
        min_length: 3,
        max_length: 10,
      });
      expect(tooLong.valid).toBe(false);
    });
  });

  describe('Real-world PIN collection scenarios', () => {
    it('should validate 4-digit security PIN', () => {
      const testCases = [
        { input: '0000', valid: true },
        { input: '1234', valid: true },
        { input: '9999', valid: true },
        { input: '000', valid: false }, // Too short
        { input: '00000', valid: true }, // 5 digits still valid for PIN
        { input: '12a4', valid: false }, // Non-numeric
      ];

      testCases.forEach(({ input, valid }) => {
        const result = DTMFRouter.validateInput(input, 'pin');
        expect(result.valid).toBe(valid);
      });
    });

    it('should validate bank account numbers', () => {
      const testCases = [
        { input: '12345678', valid: true }, // 8 digits
        { input: '1234567890', valid: true }, // 10 digits
        { input: '1234567890123456', valid: true }, // 16 digits
        { input: '1234567', valid: false }, // 7 digits (too short)
        { input: '12345678901234567', valid: false }, // 17 digits (too long)
        { input: '123456789A', valid: false }, // Non-numeric
      ];

      testCases.forEach(({ input, valid }) => {
        const result = DTMFRouter.validateInput(input, 'account_number');
        expect(result.valid).toBe(valid);
      });
    });

    it('should validate appointment confirmation inputs', () => {
      const testCases = [
        { input: '1', valid: true, meaning: 'Yes, confirm' },
        { input: '2', valid: true, meaning: 'No, cancel' },
        { input: '0', valid: false },
        { input: '3', valid: false },
        { input: '11', valid: false },
      ];

      testCases.forEach(({ input, valid }) => {
        const result = DTMFRouter.validateInput(input, 'confirmation');
        expect(result.valid).toBe(valid);
      });
    });
  });

  describe('Edge cases and security', () => {
    it('should reject injection attempts in PIN', () => {
      const injectionAttempts = [
        "1234'; DROP TABLE pins;--",
        '1234<script>alert(1)</script>',
        '1234 OR 1=1',
        "1234' OR '1'='1",
      ];

      injectionAttempts.forEach((attempt) => {
        const result = DTMFRouter.validateInput(attempt, 'pin');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Input must contain only digits');
      });
    });

    it('should reject leading zeros incorrectly formatted', () => {
      // Leading zeros are VALID in numeric input (they're just digits)
      const result = DTMFRouter.validateInput('0001234', 'account_number');
      expect(result.valid).toBe(false); // 7 digits, below minimum
    });

    it('should handle unicode digit lookalikes', () => {
      // Unicode characters that look like digits but aren't ASCII 0-9
      const result = DTMFRouter.validateInput('１２３４', 'pin'); // Full-width digits
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input must contain only digits');
    });

    it('should reject null bytes and control characters', () => {
      const result = DTMFRouter.validateInput('12\x0034', 'pin');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Input must contain only digits');
    });
  });

  describe('Performance and stress tests', () => {
    it('should validate quickly even with very long input', () => {
      const longInvalid = '1'.repeat(1000);

      const start = Date.now();
      const result = DTMFRouter.validateInput(longInvalid, 'pin');
      const elapsed = Date.now() - start;

      expect(result.valid).toBe(false); // Too long for PIN
      expect(elapsed).toBeLessThan(10); // Should be instant
    });

    it('should handle batch validation efficiently', () => {
      const testInputs = Array.from({ length: 1000 }, (_, i) => ({
        input: `${1000 + i}`,
        type: 'pin' as const,
      }));

      const start = Date.now();
      testInputs.forEach(({ input, type }) => {
        DTMFRouter.validateInput(input, type);
      });
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(100); // 1000 validations in under 100ms
    });
  });
});

describe('DTMF PIN Validation API Integration', () => {
  const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  describe('POST /api/tools/handleDTMF with PIN collection', () => {
    it('should accept valid PIN input', async () => {
      const response = await fetch(`${API_BASE}/api/tools/handleDTMF`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: 'test-call-123',
          dtmf_input: '1234',
          input_type: 'pin',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.valid).toBe(true);
    }, 15000);

    it('should reject invalid PIN format via API', async () => {
      const response = await fetch(`${API_BASE}/api/tools/handleDTMF`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call_id: 'test-call-123',
          dtmf_input: '12', // Too short
          input_type: 'pin',
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();

      expect(data.valid).toBe(false);
      expect(data.error).toContain('PIN');
    }, 15000);
  });
});
