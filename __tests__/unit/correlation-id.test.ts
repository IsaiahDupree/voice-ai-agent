// F1307: Test error correlation ID functionality

import { describe, it, expect } from '@jest/globals'
import {
  generateCorrelationId,
  getOrCreateCorrelationId,
  attachCorrelationId,
  createLogContext,
  logWithCorrelation,
} from '@/lib/correlation-id'

describe('F1307: Correlation ID', () => {
  describe('generateCorrelationId', () => {
    it('should generate a valid UUID v4', () => {
      const id = generateCorrelationId()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('should generate unique IDs', () => {
      const id1 = generateCorrelationId()
      const id2 = generateCorrelationId()
      expect(id1).not.toBe(id2)
    })
  })

  describe('getOrCreateCorrelationId', () => {
    it('should use existing x-correlation-id header', () => {
      const headers = new Headers({ 'x-correlation-id': 'test-123' })
      const id = getOrCreateCorrelationId(headers)
      expect(id).toBe('test-123')
    })

    it('should use existing x-request-id header', () => {
      const headers = new Headers({ 'x-request-id': 'req-456' })
      const id = getOrCreateCorrelationId(headers)
      expect(id).toBe('req-456')
    })

    it('should use existing x-trace-id header', () => {
      const headers = new Headers({ 'x-trace-id': 'trace-789' })
      const id = getOrCreateCorrelationId(headers)
      expect(id).toBe('trace-789')
    })

    it('should prefer x-correlation-id over x-request-id', () => {
      const headers = new Headers({
        'x-correlation-id': 'corr-123',
        'x-request-id': 'req-456',
      })
      const id = getOrCreateCorrelationId(headers)
      expect(id).toBe('corr-123')
    })

    it('should generate new ID if no header present', () => {
      const headers = new Headers()
      const id = getOrCreateCorrelationId(headers)
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })
  })

  describe('attachCorrelationId', () => {
    it('should attach correlation ID to response headers', () => {
      const headers = new Headers()
      attachCorrelationId(headers, 'test-123')

      expect(headers.get('x-correlation-id')).toBe('test-123')
      expect(headers.get('x-request-id')).toBe('test-123')
    })
  })

  describe('createLogContext', () => {
    it('should create log context with correlation ID and timestamp', () => {
      const context = createLogContext('test-123')

      expect(context.correlationId).toBe('test-123')
      expect(context.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('should merge additional context', () => {
      const context = createLogContext('test-123', { userId: '42', action: 'create' })

      expect(context.correlationId).toBe('test-123')
      expect(context.userId).toBe('42')
      expect(context.action).toBe('create')
    })
  })

  describe('logWithCorrelation', () => {
    it('should log with correlation ID', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      logWithCorrelation('info', 'test-123', 'Test message', { foo: 'bar' })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"correlationId":"test-123"')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Test message"')
      )
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"foo":"bar"')
      )

      consoleSpy.mockRestore()
    })

    it('should use console.error for error level', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      logWithCorrelation('error', 'test-123', 'Error message')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"error"')
      )

      consoleSpy.mockRestore()
    })

    it('should use console.warn for warn level', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      logWithCorrelation('warn', 'test-123', 'Warning message')

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('"level":"warn"')
      )

      consoleSpy.mockRestore()
    })
  })
})
