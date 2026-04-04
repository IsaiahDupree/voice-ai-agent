// F1149: HSTS header - HTTP Strict Transport Security
// F1150: Content-Security-Policy header
// F1151: X-Frame-Options header
// F1152: X-Content-Type-Options header
// F1153: Referrer-Policy header

import { NextResponse } from 'next/server'

/**
 * Apply security headers to response
 * F1149: HSTS (HTTP Strict Transport Security)
 * F1150: Content-Security-Policy
 * F1151: X-Frame-Options
 * F1152: X-Content-Type-Options
 * F1153: Referrer-Policy
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  // F1149: HSTS - Enforce HTTPS for 1 year
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains; preload'
  )

  // F1150: Content-Security-Policy
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';"
  )

  // F1151: X-Frame-Options - Prevent clickjacking
  response.headers.set('X-Frame-Options', 'DENY')

  // F1152: X-Content-Type-Options - Prevent MIME type sniffing
  response.headers.set('X-Content-Type-Options', 'nosniff')

  // F1153: Referrer-Policy
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Additional security headers
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')

  return response
}
