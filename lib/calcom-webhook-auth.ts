// F0901: Cal.com webhook signature validation
import crypto from 'crypto'

/**
 * F0901: Validate Cal.com webhook signature
 *
 * Cal.com sends a signature in the X-Cal-Signature header
 * Signature is HMAC-SHA256(payload, webhook_secret)
 *
 * @returns true if signature is valid, false otherwise
 */
export function validateCalcomWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) {
    console.warn('[Cal.com Webhook Auth] Missing signature header')
    return false
  }

  if (!secret) {
    console.error('[Cal.com Webhook Auth] Missing webhook secret - set CALCOM_WEBHOOK_SECRET env var')
    return false
  }

  try {
    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex')

    // Compare signatures (constant-time comparison to prevent timing attacks)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    )

    if (!isValid) {
      console.warn('[Cal.com Webhook Auth] Invalid signature')
    }

    return isValid
  } catch (error: any) {
    console.error('[Cal.com Webhook Auth] Signature validation error:', error)
    return false
  }
}

/**
 * Alternative: Validate using x-cal-signature-256 header (if Cal.com uses this format)
 */
export function validateCalcomWebhookSignatureAlt(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false
  if (!secret) return false

  try {
    // Some webhook providers prefix with sha256=
    const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(sig),
      Buffer.from(expectedSignature)
    )
  } catch (error) {
    return false
  }
}
