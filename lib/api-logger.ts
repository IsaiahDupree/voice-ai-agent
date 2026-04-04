// F0970: API request logging - Log all API requests to request_logs table
// F0971: API request ID - Generate and track request IDs
// F1335: Log levels - Configurable log level (debug, info, warn, error)

import { supabaseAdmin } from './supabase'

/**
 * F1335: Log level configuration
 * Control verbosity of logging
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const CONFIGURED_LOG_LEVEL: LogLevel = (
  process.env.LOG_LEVEL || 'info'
) as LogLevel

/**
 * F1335: Check if a log level should be logged
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[CONFIGURED_LOG_LEVEL]
}

/**
 * F0971: Generate unique request ID
 * Uses Web Crypto API for edge runtime compatibility
 */
export function generateRequestId(): string {
  return crypto.randomUUID()
}

/**
 * F0970: Log API request to database
 * Runs async, fail-open (doesn't block request)
 */
export async function logAPIRequest(params: {
  requestId: string
  method: string
  path: string
  statusCode?: number
  duration?: number
  ip?: string
  userAgent?: string
  apiKey?: string
  error?: string
}): Promise<void> {
  try {
    await supabaseAdmin.from('voice_agent_api_request_logs').insert({
      request_id: params.requestId,
      method: params.method,
      path: params.path,
      status_code: params.statusCode || null,
      duration_ms: params.duration || null,
      ip_address: params.ip || null,
      user_agent: params.userAgent || null,
      api_key_hash: params.apiKey ? hashApiKey(params.apiKey) : null,
      error_message: params.error || null,
      created_at: new Date().toISOString(),
    })
  } catch (error) {
    // Fail-open: don't block request if logging fails
    console.error('Failed to log API request:', error)
  }
}

/**
 * F0999: Structured logging with consistent format (method, path, status, duration)
 */
export interface StructuredLogEntry {
  timestamp: string
  requestId: string
  method: string
  path: string
  statusCode?: number
  duration: number
  level: 'info' | 'warn' | 'error'
  ip?: string
  error?: string
}

export function logStructured(entry: Omit<StructuredLogEntry, 'timestamp'>): void {
  // F1335: Only log if level is enabled
  if (!shouldLog(entry.level)) {
    return
  }

  const logEntry: StructuredLogEntry = {
    ...entry,
    timestamp: new Date().toISOString(),
  }

  // Use appropriate console method based on level
  const logMethod = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  }[entry.level]

  logMethod(JSON.stringify(logEntry))
}

/**
 * Hash API key for storage (don't store raw keys)
 */
function hashApiKey(apiKey: string): string {
  // In production, use proper hashing (e.g., crypto.createHash('sha256'))
  // For now, just store last 4 chars
  return `***${apiKey.slice(-4)}`
}

/**
 * F0970: Log request with timing
 */
export class RequestLogger {
  private requestId: string
  private startTime: number
  private method: string
  private path: string
  private ip?: string
  private userAgent?: string
  private apiKey?: string

  constructor(
    requestId: string,
    method: string,
    path: string,
    ip?: string,
    userAgent?: string,
    apiKey?: string
  ) {
    this.requestId = requestId
    this.startTime = Date.now()
    this.method = method
    this.path = path
    this.ip = ip
    this.userAgent = userAgent
    this.apiKey = apiKey
  }

  async finish(statusCode: number, error?: string): Promise<void> {
    const duration = Date.now() - this.startTime

    await logAPIRequest({
      requestId: this.requestId,
      method: this.method,
      path: this.path,
      statusCode,
      duration,
      ip: this.ip,
      userAgent: this.userAgent,
      apiKey: this.apiKey,
      error,
    })
  }
}
