/**
 * GET /api/auth/login/verify?token=... — exchange a magic-link token
 * for a session JWT cookie. Returns JSON for the client-side /login/verify
 * page to redirect; could also be a 303 redirect for direct email clicks.
 *
 * Sets the auth_token cookie on success. The cookie is httpOnly,
 * sameSite=lax, secure in prod.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  verifyMagicLink,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
} from '@/lib/auth-magic-link'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 })
  }
  const result = await verifyMagicLink(token)
  if (!result.ok || !result.sessionToken) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 })
  }
  const res = NextResponse.json({
    ok: true,
    email: result.email,
    userId: result.userId,
    agencyId: result.agencyId,
    nextUrl: result.nextUrl,
  })
  res.cookies.set(SESSION_COOKIE, result.sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_SECONDS,
    path: '/',
  })
  return res
}
