// F1132: JWT secret rotation without downtime
// Supports multiple JWT secrets during rotation period
// Old tokens remain valid while new tokens use new secret

import { jwtVerify, SignJWT } from 'jose'

interface RotationConfig {
  currentSecret: string
  previousSecrets?: string[] // Secrets from previous rotations (still valid)
  algorithm?: string
}

/**
 * F1132: Sign JWT with current secret
 */
export async function signJWT(
  payload: Record<string, any>,
  config: RotationConfig,
  expiresIn: string = '7d'
): Promise<string> {
  const secret = new TextEncoder().encode(config.currentSecret)
  const algorithm = config.algorithm || 'HS256'

  const jwt = await new SignJWT(payload)
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)

  return jwt
}

/**
 * F1132: Verify JWT - tries current secret first, then previous secrets
 * This allows zero-downtime rotation
 */
export async function verifyJWT(
  token: string,
  config: RotationConfig
): Promise<{
  valid: boolean
  payload?: any
  error?: string
  usedPreviousSecret?: boolean
}> {
  const secrets = [
    config.currentSecret,
    ...(config.previousSecrets || []),
  ]

  // Try each secret in order
  for (let i = 0; i < secrets.length; i++) {
    const secret = new TextEncoder().encode(secrets[i])

    try {
      const { payload } = await jwtVerify(token, secret)

      return {
        valid: true,
        payload,
        usedPreviousSecret: i > 0, // Flag if old secret was used
      }
    } catch (error) {
      // If this was the last secret, return error
      if (i === secrets.length - 1) {
        return {
          valid: false,
          error: 'Invalid or expired token',
        }
      }
      // Otherwise try next secret
      continue
    }
  }

  return {
    valid: false,
    error: 'No valid secrets found',
  }
}

/**
 * Load JWT rotation config from environment
 * Supports comma-separated previous secrets
 */
export function getRotationConfig(): RotationConfig {
  const currentSecret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET
  const previousSecretsEnv = process.env.JWT_PREVIOUS_SECRETS || process.env.NEXTAUTH_PREVIOUS_SECRETS

  if (!currentSecret) {
    throw new Error('JWT_SECRET or NEXTAUTH_SECRET must be set')
  }

  const previousSecrets = previousSecretsEnv
    ? previousSecretsEnv.split(',').map(s => s.trim()).filter(Boolean)
    : []

  return {
    currentSecret,
    previousSecrets,
    algorithm: process.env.JWT_ALGORITHM || 'HS256',
  }
}

/**
 * Middleware helper: Check if token needs rotation
 * Returns true if token was signed with an old secret
 */
export function needsRotation(verifyResult: {
  valid: boolean
  usedPreviousSecret?: boolean
}): boolean {
  return verifyResult.valid && verifyResult.usedPreviousSecret === true
}

/**
 * Example rotation workflow:
 *
 * 1. Generate new secret
 * 2. Add current secret to NEXTAUTH_PREVIOUS_SECRETS (comma-separated)
 * 3. Set new secret as NEXTAUTH_SECRET
 * 4. Deploy - both old and new tokens work
 * 5. After TTL expires (e.g., 7 days), remove old secret from NEXTAUTH_PREVIOUS_SECRETS
 *
 * Environment variables during rotation:
 *
 * Before rotation:
 * NEXTAUTH_SECRET=old-secret-abc123
 *
 * During rotation (both valid):
 * NEXTAUTH_SECRET=new-secret-xyz789
 * NEXTAUTH_PREVIOUS_SECRETS=old-secret-abc123
 *
 * After rotation period:
 * NEXTAUTH_SECRET=new-secret-xyz789
 * NEXTAUTH_PREVIOUS_SECRETS=
 */
