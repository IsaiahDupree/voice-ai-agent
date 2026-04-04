// F1315: Test retry backoff strategy

import { describe, it, expect, jest } from '@jest/globals'
import { withRetry } from '@/lib/api-error-handler'

describe('F1315: Retry backoff strategy', () => {
  it('should use exponential backoff for retries', async () => {
    let attemptCount = 0
    const timestamps: number[] = []

    const failingFn = async () => {
      timestamps.push(Date.now())
      attemptCount++

      if (attemptCount < 4) {
        const error: any = new Error('Transient error')
        error.status = 503 // Service unavailable (retryable)
        throw error
      }

      return 'success'
    }

    const result = await withRetry(failingFn, {
      maxRetries: 3,
      retryDelayMs: 100,
      logError: false,
    })

    expect(result).toBe('success')
    expect(attemptCount).toBe(4) // Initial + 3 retries

    // Verify exponential backoff timing
    // Delays should be approximately: 100ms, 200ms, 400ms
    const delays = timestamps.slice(1).map((t, i) => t - timestamps[i])

    // First retry: ~100ms
    expect(delays[0]).toBeGreaterThanOrEqual(90)
    expect(delays[0]).toBeLessThan(150)

    // Second retry: ~200ms
    expect(delays[1]).toBeGreaterThanOrEqual(190)
    expect(delays[1]).toBeLessThan(250)

    // Third retry: ~400ms
    expect(delays[2]).toBeGreaterThanOrEqual(390)
    expect(delays[2]).toBeLessThan(450)
  })

  it('should retry only retryable errors', async () => {
    let attemptCount = 0

    const nonRetryableFn = async () => {
      attemptCount++

      const error: any = new Error('Not found')
      error.status = 404 // Not retryable
      throw error
    }

    await expect(
      withRetry(nonRetryableFn, {
        maxRetries: 3,
        logError: false,
      })
    ).rejects.toThrow('Not found')

    // Should only try once (no retries for 404)
    expect(attemptCount).toBe(1)
  })

  it('should respect maxRetries limit', async () => {
    let attemptCount = 0

    const alwaysFailFn = async () => {
      attemptCount++
      const error: any = new Error('Always fails')
      error.status = 500 // Retryable
      throw error
    }

    await expect(
      withRetry(alwaysFailFn, {
        maxRetries: 2,
        logError: false,
      })
    ).rejects.toThrow('Always fails')

    // Initial + 2 retries = 3 total attempts
    expect(attemptCount).toBe(3)
  })

  it('should retry network errors', async () => {
    let attemptCount = 0

    const networkErrorFn = async () => {
      attemptCount++

      if (attemptCount < 3) {
        const error: any = new Error('Connection refused')
        error.code = 'ECONNREFUSED'
        throw error
      }

      return 'success'
    }

    const result = await withRetry(networkErrorFn, {
      maxRetries: 3,
      retryDelayMs: 50,
      logError: false,
    })

    expect(result).toBe('success')
    expect(attemptCount).toBe(3)
  })

  it('should retry 429 rate limit errors', async () => {
    let attemptCount = 0

    const rateLimitFn = async () => {
      attemptCount++

      if (attemptCount < 2) {
        const error: any = new Error('Rate limited')
        error.status = 429
        throw error
      }

      return 'success'
    }

    const result = await withRetry(rateLimitFn, {
      maxRetries: 2,
      retryDelayMs: 50,
      logError: false,
    })

    expect(result).toBe('success')
    expect(attemptCount).toBe(2)
  })
})
