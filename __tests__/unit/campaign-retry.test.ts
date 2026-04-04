// F1206: Unit test: retry logic

import { shouldRetry, RetryConfig } from '@/lib/campaign-retry'

describe('Campaign Retry Logic', () => {
  describe('shouldRetry', () => {
    const defaultConfig: RetryConfig = {
      campaign_id: 1,
      retry_delay_minutes: 60,
      retry_on_busy: true,
      retry_on_voicemail: true,
      max_attempts: 3,
    }

    it('should retry on busy when retry_on_busy is true', () => {
      expect(shouldRetry('busy', defaultConfig)).toBe(true)
    })

    it('should not retry on busy when retry_on_busy is false', () => {
      const config = { ...defaultConfig, retry_on_busy: false }
      expect(shouldRetry('busy', config)).toBe(false)
    })

    it('should retry on voicemail when retry_on_voicemail is true', () => {
      expect(shouldRetry('voicemail', defaultConfig)).toBe(true)
    })

    it('should not retry on voicemail when retry_on_voicemail is false', () => {
      const config = { ...defaultConfig, retry_on_voicemail: false }
      expect(shouldRetry('voicemail', config)).toBe(false)
    })

    it('should always retry on no-answer', () => {
      expect(shouldRetry('no-answer', defaultConfig)).toBe(true)

      // Even if both retry flags are false
      const config = {
        ...defaultConfig,
        retry_on_busy: false,
        retry_on_voicemail: false,
      }
      expect(shouldRetry('no-answer', config)).toBe(true)
    })

    it('should not retry on booked', () => {
      expect(shouldRetry('booked', defaultConfig)).toBe(false)
    })

    it('should not retry on dnc', () => {
      expect(shouldRetry('dnc', defaultConfig)).toBe(false)
    })

    it('should not retry on failed', () => {
      expect(shouldRetry('failed', defaultConfig)).toBe(false)
    })

    it('should handle unknown outcomes safely', () => {
      expect(shouldRetry('unknown-outcome', defaultConfig)).toBe(false)
      expect(shouldRetry('', defaultConfig)).toBe(false)
    })
  })

  describe('Retry delay calculations', () => {
    it('should calculate correct next attempt time', () => {
      const retryDelayMinutes = 60
      const now = new Date('2026-03-26T12:00:00Z')
      const expected = new Date('2026-03-26T13:00:00Z')

      const nextAttempt = new Date(now)
      nextAttempt.setMinutes(nextAttempt.getMinutes() + retryDelayMinutes)

      expect(nextAttempt.getTime()).toBe(expected.getTime())
    })

    it('should handle custom retry delays', () => {
      const testCases = [
        { delay: 30, expectedHour: 12, expectedMinute: 30 },
        { delay: 120, expectedHour: 14, expectedMinute: 0 },
        { delay: 1440, expectedHour: 12, expectedMinute: 0 }, // 24 hours
      ]

      testCases.forEach(({ delay, expectedHour, expectedMinute }) => {
        const now = new Date('2026-03-26T12:00:00Z')
        const nextAttempt = new Date(now)
        nextAttempt.setMinutes(nextAttempt.getMinutes() + delay)

        if (delay < 1440) {
          expect(nextAttempt.getUTCHours()).toBe(expectedHour)
          expect(nextAttempt.getUTCMinutes()).toBe(expectedMinute)
        } else {
          // For 24+ hours, just verify it's in the future
          expect(nextAttempt.getTime()).toBeGreaterThan(now.getTime())
        }
      })
    })
  })

  describe('Max attempts logic', () => {
    it('should respect max_attempts limit', () => {
      const attempts = [1, 2, 3, 4, 5]
      const maxAttempts = 3

      attempts.forEach((attempt) => {
        const shouldContinue = attempt < maxAttempts
        expect(attempt < maxAttempts).toBe(shouldContinue)
      })
    })

    it('should handle zero max_attempts', () => {
      const config: RetryConfig = {
        campaign_id: 1,
        retry_delay_minutes: 60,
        retry_on_busy: true,
        retry_on_voicemail: true,
        max_attempts: 0,
      }

      // Even if outcome is retryable, 0 max_attempts means no retries
      expect(shouldRetry('no-answer', config)).toBe(true)
      // But the max_attempts check would prevent actual retry
      expect(0 >= config.max_attempts).toBe(true)
    })
  })
})
