// F1263-F1287: API error handling with retries and fallbacks
// F1307: Error correlation ID

import { NextRequest, NextResponse } from 'next/server'
import { ErrorCodes, ErrorCode } from './api-response'
import { sanitizeErrorMessage } from './error-sanitization'
import { getOrCreateCorrelationId, attachCorrelationId, logWithCorrelation } from './correlation-id'

interface ErrorHandlerOptions {
  maxRetries?: number
  retryDelayMs?: number
  timeout?: number
  fallback?: () => Promise<any>
  logError?: boolean
}

interface RetryableError extends Error {
  code?: string
  status?: number
  retryable?: boolean
}

/**
 * Check if error is retryable (transient error)
 */
function isRetryableError(error: any): boolean {
  const code = error.code || error.status || ''
  const message = error.message || ''

  // Network errors
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
    return true
  }

  // HTTP 5xx errors (except 501 Not Implemented)
  if (error.status >= 500 && error.status !== 501) {
    return true
  }

  // Rate limit (429)
  if (error.status === 429) {
    return true
  }

  // Explicit retryable flag
  if (error.retryable === true) {
    return true
  }

  // Database transient errors
  if (message.includes('connection') || message.includes('timeout')) {
    return true
  }

  return false
}

/**
 * F1266, F1268, F1283: Retry async operation with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    retryDelayMs = 100,
    timeout = 30000,
    fallback,
    logError = true,
  } = options

  let lastError: any

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Use timeout wrapper
      const result = await withTimeout(fn(), timeout)
      return result
    } catch (error) {
      lastError = error

      // Check if error is retryable
      if (!isRetryableError(error) || attempt === maxRetries) {
        break
      }

      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = retryDelayMs * Math.pow(2, attempt)

      if (logError && attempt < maxRetries) {
        console.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
          error: (error as any).message,
          code: (error as any).code,
        })
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // Try fallback if provided
  if (fallback) {
    try {
      return await fallback()
    } catch (fallbackError) {
      if (logError) {
        console.error('Fallback also failed', fallbackError)
      }
    }
  }

  throw lastError
}

/**
 * F1280: Timeout wrapper for async operations
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  return Promise.race([promise, timeoutPromise])
}

/**
 * F1263, F1264: Wrap API handler with error handling
 * F1307: Add correlation ID to all error responses
 */
export function withErrorHandler(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: ErrorHandlerOptions = {}
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    // F1307: Get or create correlation ID
    const correlationId = getOrCreateCorrelationId(req.headers)

    try {
      const response = await withRetry(() => handler(req), options)

      // F1307: Attach correlation ID to successful responses too
      attachCorrelationId(response.headers, correlationId)

      return response
    } catch (error: any) {
      const isDev = process.env.NODE_ENV === 'development'
      const message = sanitizeErrorMessage(error, isDev)
      const status = error.status || 500
      const code = error.code || ErrorCodes.INTERNAL_ERROR

      // F1307: Log error with correlation ID
      logWithCorrelation('error', correlationId, 'API Error', {
        method: req.method,
        path: req.nextUrl.pathname,
        status,
        code,
        message: error.message,
        stack: isDev ? error.stack : undefined,
      })

      const response = NextResponse.json(
        {
          success: false,
          error: {
            code,
            message,
            correlation_id: correlationId, // F1307: Include in error response
          },
        },
        { status }
      )

      // F1307: Attach correlation ID to response headers
      attachCorrelationId(response.headers, correlationId)

      return response
    }
  }
}

/**
 * F1279: LLM parameter validation before tool execution
 */
export interface ToolParams {
  [key: string]: any
}

export function validateToolParams(
  params: ToolParams,
  schema: Record<string, { type: string; required?: boolean }>
): { valid: boolean; error?: string } {
  for (const [key, config] of Object.entries(schema)) {
    if (config.required && !(key in params)) {
      return {
        valid: false,
        error: `Missing required parameter: ${key}`,
      }
    }

    if (key in params) {
      const value = params[key]
      const expectedType = config.type

      // Type validation
      let actualType: string = typeof value
      if (Array.isArray(value)) {
        actualType = 'array'
      } else if (value === null) {
        actualType = 'null'
      }

      if (expectedType === 'phone') {
        if (!value.match(/^\+?[\d\s\-\(\)]{10,}$/)) {
          return {
            valid: false,
            error: `Invalid phone number format: ${key}`,
          }
        }
      } else if (expectedType === 'email') {
        if (!value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
          return {
            valid: false,
            error: `Invalid email format: ${key}`,
          }
        }
      } else if (expectedType === 'date') {
        if (!value.match(/^\d{4}-\d{2}-\d{2}$/)) {
          return {
            valid: false,
            error: `Invalid date format (YYYY-MM-DD): ${key}`,
          }
        }
      } else if (expectedType !== actualType && expectedType !== 'any') {
        return {
          valid: false,
          error: `Invalid type for ${key}: expected ${expectedType}, got ${actualType}`,
        }
      }
    }
  }

  return { valid: true }
}

/**
 * F1267: Provide fallback option (e.g., email booking when Cal.com fails)
 */
export async function withFallback<T>(
  primary: () => Promise<T>,
  fallback: () => Promise<T>,
  description: string = 'operation'
): Promise<T> {
  try {
    return await primary()
  } catch (error) {
    console.warn(`Primary ${description} failed, trying fallback:`, error)
    try {
      return await fallback()
    } catch (fallbackError) {
      console.error(`Fallback ${description} also failed:`, fallbackError)
      throw new Error(
        `Both primary and fallback ${description} failed: ${(error as any).message}`
      )
    }
  }
}

/**
 * Create structured error response
 * F1307: Include correlation ID in error responses
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number = 500,
  details?: any,
  correlationId?: string
): NextResponse {
  const response = NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
        correlation_id: correlationId, // F1307
      },
    },
    { status }
  )

  // F1307: Attach correlation ID to headers if provided
  if (correlationId) {
    attachCorrelationId(response.headers, correlationId)
  }

  return response
}
