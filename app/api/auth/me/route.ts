/**
 * GET /api/auth/me — current session identity.
 *
 * Reads the auth_token cookie, verifies the JWT, returns the claims.
 * Returns 401 when no/invalid session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readSession, SESSION_COOKIE } from '@/lib/auth-magic-link'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  const claims = await readSession(token)
  if (!claims) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true, ...claims })
}
