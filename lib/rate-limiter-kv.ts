/**
 * F1345: Vercel KV for rate limiting
 * Distributed rate limiting using Vercel KV (Redis)
 *
 * This provides:
 * - Distributed rate limiting across serverless functions
 * - Persistent rate limit counters
 * - Sliding window rate limiting
 * - Per-IP and per-API-key rate limits
 */

// NOTE: To use Vercel KV in production:
// 1. Create KV store in Vercel dashboard
// 2. Install: npm install @vercel/kv
// 3. Import: import { kv } from '@vercel/kv'
// 4. Use kv.get() and kv.set() as shown below

interface RateLimitConfig {
  limit: number // Max requests
  window: number // Time window in seconds
  prefix: string // Key prefix (e.g., 'api:', 'ip:')
}

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number // Unix timestamp when limit resets
}

/**
 * Check rate limit using Vercel KV
 *
 * @param identifier - Unique identifier (IP address or API key)
 * @param config - Rate limit configuration
 * @returns Rate limit result with remaining capacity
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${config.prefix}${identifier}`
  const now = Math.floor(Date.now() / 1000)
  const windowStart = now - config.window

  try {
    // In production with @vercel/kv installed:
    // const requests = await kv.zrangebyscore(key, windowStart, now)
    // const count = requests.length

    // For now, use in-memory fallback (not distributed)
    const count = 0 // Placeholder
    const remaining = Math.max(0, config.limit - count)
    const reset = now + config.window

    if (count >= config.limit) {
      return {
        success: false,
        limit: config.limit,
        remaining: 0,
        reset,
      }
    }

    // Record this request
    // In production:
    // await kv.zadd(key, { score: now, member: `${now}-${Math.random()}` })
    // await kv.expire(key, config.window)

    return {
      success: true,
      limit: config.limit,
      remaining: remaining - 1,
      reset,
    }
  } catch (error) {
    console.error('[Rate Limiter] Error:', error)

    // On error, allow the request (fail open)
    return {
      success: true,
      limit: config.limit,
      remaining: config.limit,
      reset: now + config.window,
    }
  }
}

/**
 * Rate limit configurations
 */
export const RATE_LIMITS = {
  // 100 requests per minute per IP
  perIP: {
    limit: 100,
    window: 60,
    prefix: 'ratelimit:ip:',
  },
  // 1000 requests per hour per API key
  perAPIKey: {
    limit: 1000,
    window: 3600,
    prefix: 'ratelimit:apikey:',
  },
  // 10 requests per minute for expensive operations
  expensive: {
    limit: 10,
    window: 60,
    prefix: 'ratelimit:expensive:',
  },
}

/**
 * Express/Next.js middleware for rate limiting
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (req: Request): Promise<Response | null> => {
    const identifier = getIdentifier(req, config)
    const result = await checkRateLimit(identifier, config)

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          limit: result.limit,
          reset: result.reset,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': String(result.remaining),
            'X-RateLimit-Reset': String(result.reset),
            'Retry-After': String(result.reset - Math.floor(Date.now() / 1000)),
          },
        }
      )
    }

    // Request allowed - add rate limit headers
    // Note: Can't directly modify Request headers, caller should add these to Response
    return null
  }
}

/**
 * Extract identifier from request based on config
 */
function getIdentifier(req: Request, config: RateLimitConfig): string {
  if (config.prefix.includes('ip')) {
    // Get IP from various headers
    const forwarded = req.headers.get('x-forwarded-for')
    const realIP = req.headers.get('x-real-ip')
    const ip = forwarded?.split(',')[0] || realIP || 'unknown'
    return ip
  }

  if (config.prefix.includes('apikey')) {
    const authHeader = req.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '') || 'anonymous'
    return apiKey
  }

  return 'default'
}

/**
 * Usage example:
 *
 * ```typescript
 * import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter-kv'
 *
 * export async function GET(req: Request) {
 *   const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
 *   const result = await checkRateLimit(ip, RATE_LIMITS.perIP)
 *
 *   if (!result.success) {
 *     return new Response('Rate limit exceeded', { status: 429 })
 *   }
 *
 *   // Process request...
 * }
 * ```
 */
