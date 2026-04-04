// F1176: Error message sanitization - Remove sensitive info from error responses

/**
 * F1176: Sanitize error messages for external exposure
 * Removes sensitive information like stack traces, database errors, internal paths
 */
export function sanitizeErrorMessage(error: any, isDevelopment: boolean = false): string {
  if (isDevelopment) {
    // In development, show full error
    return error.message || String(error)
  }

  // In production, show generic message
  const message = error.message || String(error)

  // Don't expose database errors
  if (message.includes('SQL') || message.includes('query')) {
    return 'Database operation failed'
  }

  // Don't expose file system paths
  if (message.includes('/') || message.includes('\\')) {
    return 'System error occurred'
  }

  // Don't expose API keys or secrets
  if (message.includes('key') || message.includes('secret') || message.includes('password')) {
    return 'Authentication error'
  }

  // Safe error messages that can be exposed
  const safePatterns = [
    'not found',
    'already exists',
    'invalid',
    'required',
    'expired',
    'rate limit',
    'timeout',
  ]

  for (const pattern of safePatterns) {
    if (message.toLowerCase().includes(pattern)) {
      return message
    }
  }

  // Default to generic error
  return 'An error occurred'
}

/**
 * Sanitize error object for API response
 * Removes stack traces and sensitive data
 */
export function createSafeErrorResponse(
  error: any,
  code: string = 'INTERNAL_ERROR'
): {
  error: string
  code: string
  message: string
  status: number
} {
  const isDev = process.env.NODE_ENV === 'development'
  const message = sanitizeErrorMessage(error, isDev)

  // Determine HTTP status
  let status = 500
  if (error.status) {
    status = error.status
  } else if (error.code === 'PGRST116') {
    status = 404 // Not found
  } else if (error.code === '23505') {
    status = 409 // Conflict
  }

  return {
    error: code,
    code,
    message,
    status,
  }
}

/**
 * Remove sensitive fields from error stack
 */
export function removeSensitiveStackTrace(stack: string): string {
  if (!stack) return ''

  // Remove full file paths
  let sanitized = stack.replace(/\/[^\s]+\//g, '/<hidden>/')

  // Remove database URLs
  sanitized = sanitized.replace(/postgres:\/\/[^\s]+/g, 'postgres://<hidden>')
  sanitized = sanitized.replace(/mysql:\/\/[^\s]+/g, 'mysql://<hidden>')

  // Remove API keys
  sanitized = sanitized.replace(/[ak]_[\w]+/g, '<hidden>')

  return sanitized
}

/**
 * Log error with full details internally
 * While exposing safe message to user
 */
export function logErrorSecurely(
  error: any,
  context: Record<string, any> = {}
): {
  safeMessage: string
  logId: string
} {
  const logId = generateErrorLogId()

  // Log full error internally
  console.error(`[Error ${logId}]`, {
    message: error.message,
    stack: error.stack,
    code: error.code,
    context,
    timestamp: new Date().toISOString(),
  })

  // Return safe message for user
  const safeMessage = sanitizeErrorMessage(error)

  return {
    safeMessage,
    logId,
  }
}

/**
 * Generate error log ID for tracing
 */
function generateErrorLogId(): string {
  return `ERR_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}
