// F0962: API rate limiting - 100 req/min per API key
// F0963: API rate limit headers in all responses
// F0969: CORS configuration - allow dashboard origin only
// F0971: API request ID - X-Request-ID header on all requests
// F0970: API request logging - log all API requests
// F1133: API key authentication - Support API key auth as alternative to JWT

import { NextRequest, NextResponse } from 'next/server'
import { generateRequestId, logAPIRequest, logStructured } from './lib/api-logger'
import { authenticateApiKey, extractApiKeyFromRequest } from './lib/api-keys'
import { addSecurityHeaders } from './lib/security-headers'

// Rate limiting store (in-memory for now - use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

// F0962, F0963: Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100

// F1136: Global rate limit - 1000 req/min per IP
const GLOBAL_RATE_LIMIT_MAX = 1000

// F1137: Per-API-key rate limit
const API_KEY_RATE_LIMIT_MAX = 500

// F1138: Webhook rate limit - separate limit for webhooks
const WEBHOOK_RATE_LIMIT_MAX = 2000

// F0969: CORS configuration
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.DASHBOARD_URL,
].filter(Boolean)

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const startTime = Date.now()

  // Only apply to API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // F0971: Generate request ID
  const requestId = request.headers.get('x-request-id') || generateRequestId()

  // F0969: CORS configuration
  const origin = request.headers.get('origin')
  const response = NextResponse.next()

  // F1149-F1153: Apply security headers
  const secureResponse = addSecurityHeaders(response)

  // F0971: Add request ID to response headers
  secureResponse.headers.set('X-Request-ID', requestId)

  // Set CORS headers
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    secureResponse.headers.set('Access-Control-Allow-Origin', origin)
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all origins in development
    secureResponse.headers.set('Access-Control-Allow-Origin', origin || '*')
  }

  secureResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  secureResponse.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-API-Key, X-Requested-With'
  )
  secureResponse.headers.set('Access-Control-Max-Age', '86400')

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: secureResponse.headers })
  }

  // Skip rate limiting for health checks
  if (pathname === '/api/health') {
    return response
  }

  // F0962, F0963, F1136, F1137, F1138: Rate limiting with multiple limits
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const remainingHeaders = Object.fromEntries(secureResponse.headers)

  const now = Date.now()

  // Determine rate limit based on request type
  const isWebhook = pathname.startsWith('/api/webhooks/')
  let rateLimitMax: number
  let rateLimitIdentifier: string

  if (isWebhook) {
    // F1138: Webhook rate limit - separate limit
    rateLimitIdentifier = `webhook:${ip}`
    rateLimitMax = WEBHOOK_RATE_LIMIT_MAX
  } else if (apiKey) {
    // F1137: Per-API-key rate limit
    rateLimitIdentifier = `apikey:${apiKey}`
    rateLimitMax = API_KEY_RATE_LIMIT_MAX
  } else {
    // F1136: Global rate limit per IP
    rateLimitIdentifier = `global:${ip}`
    rateLimitMax = GLOBAL_RATE_LIMIT_MAX
  }

  const rateLimit = rateLimitStore.get(rateLimitIdentifier)

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    // 1% chance
    for (const [key, value] of Array.from(rateLimitStore.entries())) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }
  }

  // Initialize or update rate limit
  if (!rateLimit || rateLimit.resetAt < now) {
    rateLimitStore.set(rateLimitIdentifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
  } else {
    rateLimit.count++
  }

  const currentLimit = rateLimitStore.get(rateLimitIdentifier)!
  const remaining = Math.max(0, rateLimitMax - currentLimit.count)
  const resetIn = Math.ceil((currentLimit.resetAt - now) / 1000)

  // F0963: Add rate limit headers
  secureResponse.headers.set('X-RateLimit-Limit', String(rateLimitMax))
  secureResponse.headers.set('X-RateLimit-Remaining', String(remaining))
  secureResponse.headers.set('X-RateLimit-Reset', String(currentLimit.resetAt))
  secureResponse.headers.set('X-RateLimit-Reset-After', String(resetIn))

  // F0962: Return 429 if rate limit exceeded
  if (currentLimit.count > rateLimitMax) {
    // F0970: Log rate limit exceeded
    const duration = Date.now() - startTime

    // F0999: Structured logging with consistent format
    logStructured({
      requestId,
      method: request.method,
      path: pathname,
      statusCode: 429,
      duration,
      level: 'warn',
      ip,
      error: 'Rate limit exceeded',
    })

    logAPIRequest({
      requestId,
      method: request.method,
      path: pathname,
      statusCode: 429,
      duration,
      ip,
      userAgent: request.headers.get('user-agent') || undefined,
      apiKey: apiKey || undefined,
      error: 'Rate limit exceeded',
    })

    return new NextResponse(
      JSON.stringify({
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        limit: rateLimitMax,
        remaining: 0,
        resetAfter: resetIn,
        message: `Too many requests. Please wait ${resetIn} seconds before trying again.`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(resetIn),
          'X-RateLimit-Limit': String(rateLimitMax),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(currentLimit.resetAt),
          'X-RateLimit-Reset-After': String(resetIn),
          'X-Request-ID': requestId,
          ...remainingHeaders,
        },
      }
    )
  }

  // F0970: Log successful request (async, fire-and-forget)
  // Status code will be logged by response handler
  const duration = Date.now() - startTime

  // F0999: Structured logging with consistent format
  logStructured({
    requestId,
    method: request.method,
    path: pathname,
    duration,
    level: 'info',
    ip,
  })

  logAPIRequest({
    requestId,
    method: request.method,
    path: pathname,
    duration,
    ip,
    userAgent: request.headers.get('user-agent') || undefined,
    apiKey: apiKey || undefined,
  })

  return secureResponse
}

export const config = {
  matcher: '/api/:path*',
}
