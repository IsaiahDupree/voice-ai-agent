// F1307: Error correlation ID for request tracing
import { randomUUID } from 'crypto'

/**
 * F1307: Generate a unique correlation ID for each request
 * Format: UUID v4 (e.g., "550e8400-e29b-41d4-a716-446655440000")
 */
export function generateCorrelationId(): string {
  return randomUUID()
}

/**
 * Extract correlation ID from request headers or generate new one
 * Supports both incoming correlation IDs and generating new ones
 */
export function getOrCreateCorrelationId(headers: Headers): string {
  // Check if client sent correlation ID
  const existingId =
    headers.get('x-correlation-id') ||
    headers.get('x-request-id') ||
    headers.get('x-trace-id')

  if (existingId) {
    return existingId
  }

  // Generate new correlation ID
  return generateCorrelationId()
}

/**
 * Attach correlation ID to response headers
 */
export function attachCorrelationId(headers: Headers, correlationId: string): void {
  headers.set('x-correlation-id', correlationId)
  headers.set('x-request-id', correlationId) // Alternative header name
}

/**
 * Create a logger context with correlation ID
 */
export interface LogContext {
  correlationId: string
  timestamp: string
  [key: string]: any
}

export function createLogContext(correlationId: string, additionalContext?: Record<string, any>): LogContext {
  return {
    correlationId,
    timestamp: new Date().toISOString(),
    ...additionalContext,
  }
}

/**
 * Log with correlation ID
 */
export function logWithCorrelation(
  level: 'info' | 'warn' | 'error',
  correlationId: string,
  message: string,
  context?: Record<string, any>
): void {
  const logData = {
    level,
    message,
    ...createLogContext(correlationId, context),
  }

  const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
  logFn(JSON.stringify(logData))
}
