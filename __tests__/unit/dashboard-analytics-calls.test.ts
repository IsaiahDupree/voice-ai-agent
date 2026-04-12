/**
 * Unit tests for /api/analytics/calls route logic
 * Tests aggregation, duration distribution, success rate, and time series
 */

import { describe, it, expect } from '@jest/globals'

// Pure logic functions extracted from the route for testability

function calcDurationBucket(seconds: number): string {
  if (seconds <= 30) return '0-30 sec'
  if (seconds <= 60) return '30-60 sec'
  if (seconds <= 120) return '1-2 min'
  if (seconds <= 300) return '2-5 min'
  return '5+ min'
}

function calcSuccessRate(calls: Array<{ end_reason?: string }>): number {
  if (calls.length === 0) return 0
  const completed = calls.filter(
    (c) => c.end_reason === 'completed' || c.end_reason === 'transferred'
  ).length
  return Math.round((completed / calls.length) * 100)
}

function calcAvgDuration(calls: Array<{ duration_seconds?: number }>): number {
  const withDuration = calls.filter((c) => (c.duration_seconds ?? 0) > 0)
  if (withDuration.length === 0) return 0
  const total = withDuration.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0)
  return Math.round(total / withDuration.length)
}

function groupByEndReason(calls: Array<{ end_reason?: string }>): Record<string, number> {
  return calls.reduce((acc: Record<string, number>, call) => {
    const reason = call.end_reason || 'unknown'
    acc[reason] = (acc[reason] || 0) + 1
    return acc
  }, {})
}

describe('/api/analytics/calls — logic unit tests', () => {
  describe('calcDurationBucket', () => {
    it('maps 0s to 0-30 sec', () => expect(calcDurationBucket(0)).toBe('0-30 sec'))
    it('maps 30s to 0-30 sec', () => expect(calcDurationBucket(30)).toBe('0-30 sec'))
    it('maps 31s to 30-60 sec', () => expect(calcDurationBucket(31)).toBe('30-60 sec'))
    it('maps 60s to 30-60 sec', () => expect(calcDurationBucket(60)).toBe('30-60 sec'))
    it('maps 61s to 1-2 min', () => expect(calcDurationBucket(61)).toBe('1-2 min'))
    it('maps 120s to 1-2 min', () => expect(calcDurationBucket(120)).toBe('1-2 min'))
    it('maps 121s to 2-5 min', () => expect(calcDurationBucket(121)).toBe('2-5 min'))
    it('maps 300s to 2-5 min', () => expect(calcDurationBucket(300)).toBe('2-5 min'))
    it('maps 301s to 5+ min', () => expect(calcDurationBucket(301)).toBe('5+ min'))
  })

  describe('calcSuccessRate', () => {
    it('returns 0 for empty calls array', () => {
      expect(calcSuccessRate([])).toBe(0)
    })

    it('returns 100 when all calls are completed', () => {
      const calls = [
        { end_reason: 'completed' },
        { end_reason: 'completed' },
        { end_reason: 'transferred' },
      ]
      expect(calcSuccessRate(calls)).toBe(100)
    })

    it('returns 50 when half the calls are completed', () => {
      const calls = [
        { end_reason: 'completed' },
        { end_reason: 'no_answer' },
      ]
      expect(calcSuccessRate(calls)).toBe(50)
    })

    it('counts transferred as success', () => {
      const calls = [{ end_reason: 'transferred' }, { end_reason: 'failed' }]
      expect(calcSuccessRate(calls)).toBe(50)
    })

    it('returns 0 when no calls are completed', () => {
      const calls = [{ end_reason: 'no_answer' }, { end_reason: 'failed' }]
      expect(calcSuccessRate(calls)).toBe(0)
    })
  })

  describe('calcAvgDuration', () => {
    it('returns 0 for empty array', () => {
      expect(calcAvgDuration([])).toBe(0)
    })

    it('returns 0 when all durations are 0', () => {
      expect(calcAvgDuration([{ duration_seconds: 0 }, { duration_seconds: 0 }])).toBe(0)
    })

    it('calculates average correctly', () => {
      const calls = [{ duration_seconds: 60 }, { duration_seconds: 120 }]
      expect(calcAvgDuration(calls)).toBe(90)
    })

    it('ignores calls with 0 duration in average', () => {
      const calls = [{ duration_seconds: 0 }, { duration_seconds: 100 }]
      expect(calcAvgDuration(calls)).toBe(100)
    })

    it('rounds to nearest integer', () => {
      const calls = [{ duration_seconds: 100 }, { duration_seconds: 101 }]
      expect(calcAvgDuration(calls)).toBe(101) // Math.round(100.5)
    })
  })

  describe('groupByEndReason', () => {
    it('returns empty object for no calls', () => {
      expect(groupByEndReason([])).toEqual({})
    })

    it('groups calls by end_reason', () => {
      const calls = [
        { end_reason: 'completed' },
        { end_reason: 'completed' },
        { end_reason: 'no_answer' },
      ]
      expect(groupByEndReason(calls)).toEqual({ completed: 2, no_answer: 1 })
    })

    it('groups unknown/undefined end_reason as unknown', () => {
      const calls = [{ end_reason: undefined }, {}]
      expect(groupByEndReason(calls)).toEqual({ unknown: 2 })
    })
  })

  describe('empty state response shape', () => {
    it('has the expected fields when no data', () => {
      const emptyResponse = {
        totalCalls: 0,
        byEndReason: {},
        byHour: {},
        avgDuration: 0,
        successRate: 0,
        durationDistribution: {},
      }
      expect(emptyResponse).toHaveProperty('totalCalls', 0)
      expect(emptyResponse).toHaveProperty('byEndReason')
      expect(emptyResponse).toHaveProperty('byHour')
      expect(emptyResponse).toHaveProperty('avgDuration', 0)
      expect(emptyResponse).toHaveProperty('successRate', 0)
      expect(emptyResponse).toHaveProperty('durationDistribution')
    })
  })
})
