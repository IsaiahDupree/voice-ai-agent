// F1180: JWT audience validation

import { jwtVerify } from 'jose'

interface JWTPayload {
  aud?: string | string[]
  sub?: string
  iss?: string
  exp?: number
  [key: string]: any
}

/**
 * F1180: Validate JWT audience claim
 * Ensures JWT is intended for this service
 */
export async function validateJWTAudience(
  token: string,
  expectedAudience: string
): Promise<{
  valid: boolean
  payload?: JWTPayload
  error?: string
}> {
  try {
    // Decode JWT without verification for aud check
    // In production, verify signature first
    const parts = token.split('.')
    if (parts.length !== 3) {
      return {
        valid: false,
        error: 'Invalid JWT format',
      }
    }

    // Decode payload (part[1])
    const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8')
    const payload = JSON.parse(payloadStr) as JWTPayload

    // Check audience claim
    if (!payload.aud) {
      return {
        valid: false,
        error: 'Missing aud (audience) claim in JWT',
      }
    }

    // Audience can be string or array
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]

    if (!audiences.includes(expectedAudience)) {
      return {
        valid: false,
        error: `Invalid audience. Expected: ${expectedAudience}, got: ${audiences.join(', ')}`,
      }
    }

    // Check expiration
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp < now) {
        return {
          valid: false,
          error: 'JWT token has expired',
        }
      }
    }

    return {
      valid: true,
      payload,
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Failed to validate JWT',
    }
  }
}

/**
 * Extract audience from JWT without validation
 */
export function extractAudience(token: string): string | string[] | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    const payloadStr = Buffer.from(parts[1], 'base64').toString('utf-8')
    const payload = JSON.parse(payloadStr)

    return payload.aud || null
  } catch (error) {
    return null
  }
}

/**
 * Check if JWT has valid audience claim
 */
export function hasValidAudience(
  token: string,
  expectedAudience: string
): boolean {
  const aud = extractAudience(token)

  if (!aud) {
    return false
  }

  const audiences = Array.isArray(aud) ? aud : [aud]
  return audiences.includes(expectedAudience)
}
