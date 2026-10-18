/**
 * POST /api/auth/login — request a magic link.
 *
 * Body: { email, nextUrl? }
 * Response is always 200 with { ok: true } regardless of whether an
 * email was actually sent. This avoids leaking which addresses exist
 * (account enumeration). Rate-limit silently caps at 5 sends per email
 * per 15 minutes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { issueMagicLink } from '@/lib/auth-magic-link'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const email = String(body.email ?? '').trim()
  const nextUrl = typeof body.nextUrl === 'string' ? body.nextUrl : undefined

  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'invalid_email' }, { status: 400 })
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  const userAgent = req.headers.get('user-agent') ?? null

  try {
    await issueMagicLink({ email, nextUrl, origin: origin ?? undefined, ip, userAgent })
  } catch (err: any) {
    // Don't leak details to the client; log internally.
    console.error('[auth/login] issue failed:', err?.message ?? err)
  }
  return NextResponse.json({ ok: true })
}
