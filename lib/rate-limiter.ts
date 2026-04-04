// F0962: API rate limiting - 100 req/min per API key
// F0963: API rate limit headers in all responses
// F0164: Inbound call rate limiting - Limit calls per number per hour

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from './supabase'

interface RateLimitStore {
  count: number
  resetAt: number
}

// In-memory rate limit store (per API key or IP)
const rateLimitMap = new Map<string, RateLimitStore>()

const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100 // 100 requests per minute

/**
 * F0962: Rate limit check - returns whether request should be allowed
 */
export function checkRateLimit(identifier: string): {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const existing = rateLimitMap.get(identifier)

  // No existing entry or window expired - create new
  if (!existing || now >= existing.resetAt) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS
    rateLimitMap.set(identifier, { count: 1, resetAt })

    return {
      allowed: true,
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt,
    }
  }

  // Increment count
  existing.count++

  // Check if over limit
  const allowed = existing.count <= RATE_LIMIT_MAX_REQUESTS
  const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - existing.count)

  return {
    allowed,
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining,
    resetAt: existing.resetAt,
  }
}

/**
 * F0963: Add rate limit headers to response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  rateLimit: {
    limit: number
    remaining: number
    resetAt: number
  }
): NextResponse {
  response.headers.set('X-RateLimit-Limit', String(rateLimit.limit))
  response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining))
  response.headers.set('X-RateLimit-Reset', String(Math.floor(rateLimit.resetAt / 1000)))

  return response
}

/**
 * F0962 + F0963: Rate limiting middleware wrapper
 * Wraps an API route handler with rate limiting
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    // Get identifier - prefer API key, fallback to IP
    const apiKey = req.headers.get('x-api-key') || req.headers.get('authorization')
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
    const identifier = apiKey || ip

    // Check rate limit
    const rateLimit = checkRateLimit(identifier)

    // If rate limit exceeded, return 429
    if (!rateLimit.allowed) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded. Please try again later.',
            details: {
              limit: rateLimit.limit,
              resetAt: new Date(rateLimit.resetAt).toISOString(),
            },
          },
        },
        { status: 429 }
      )

      return addRateLimitHeaders(response, rateLimit)
    }

    // Execute handler
    const response = await handler(req)

    // Add rate limit headers to successful response
    return addRateLimitHeaders(response, rateLimit)
  }
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits() {
  const now = Date.now()
  let cleaned = 0

  for (const [key, value] of Array.from(rateLimitMap.entries())) {
    if (now >= value.resetAt) {
      rateLimitMap.delete(key)
      cleaned++
    }
  }

  if (cleaned > 0) {
    console.log(`Rate limiter: cleaned up ${cleaned} expired entries`)
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimits, 5 * 60 * 1000)
}

/**
 * F0164: Inbound call rate limiting - Limit calls per number per hour
 * Checks if a phone number has exceeded the hourly call limit
 */
export async function checkInboundCallRateLimit(phoneNumber: string): Promise<{
  allowed: boolean
  count: number
  limit: number
  resetAt: Date
}> {
  try {
    const limit = parseInt(process.env.INBOUND_RATE_LIMIT_CALLS_PER_HOUR || '10', 10)
    const windowMinutes = 60 // 1 hour window

    const windowStart = new Date()
    windowStart.setMinutes(windowStart.getMinutes() - windowMinutes)

    // Count calls from this number in the last hour
    const { data: calls, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id')
      .eq('from_number', phoneNumber)
      .eq('direction', 'inbound')
      .gte('started_at', windowStart.toISOString())

    if (error) {
      console.error('Inbound rate limit check error:', error)
      // Allow call if check fails (fail open)
      return {
        allowed: true,
        count: 0,
        limit,
        resetAt: new Date(Date.now() + windowMinutes * 60 * 1000),
      }
    }

    const count = calls?.length || 0
    const allowed = count < limit

    if (!allowed) {
      console.log(`Inbound call rate limit exceeded for ${phoneNumber}: ${count}/${limit} calls in last hour`)
    }

    return {
      allowed,
      count,
      limit,
      resetAt: new Date(Date.now() + windowMinutes * 60 * 1000),
    }
  } catch (error: any) {
    console.error('Inbound rate limit error:', error)
    // Fail open - allow call if rate limit check fails
    return {
      allowed: true,
      count: 0,
      limit: 10,
      resetAt: new Date(Date.now() + 60 * 60 * 1000),
    }
  }
}

/**
 * F0164: Log when rate limit is hit for monitoring
 */
export async function logInboundRateLimitHit(phoneNumber: string, callId: string) {
  try {
    await supabaseAdmin.from('voice_agent_rate_limit_hits').insert({
      phone_number: phoneNumber,
      call_id: callId,
      timestamp: new Date().toISOString(),
      type: 'inbound_call',
    })
  } catch (error) {
    console.error('Failed to log inbound rate limit hit:', error)
    // Don't throw - this is best-effort logging
  }
}
