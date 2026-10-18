/**
 * Magic-link auth — Sprint 5.4 (PRD §6 / UX-SPEC §3.1).
 *
 * Two functions matter:
 *   issueMagicLink({email, nextUrl, ip?, userAgent?}) — generates a
 *     one-time token, persists it (15min TTL), emails the link via
 *     Resend, returns audit metadata. Rate-limited per email.
 *   verifyMagicLink(token) — single-use exchange. Returns a session
 *     JWT (signed with JWT_SECRET, 30-day TTL) and the user identity
 *     the cookie should carry.
 *
 * Session model: JWT in httpOnly cookie `auth_token`. The same cookie
 * the existing /api/auth/refresh + logout routes were stubbed against.
 *
 * Rate limit: max 5 requests per (email, 15min). The 6th is silently
 * accepted (200 OK) but no email is sent — defends against enumeration
 * without leaking which addresses are valid.
 */

import { SignJWT, jwtVerify } from 'jose'
import crypto from 'crypto'
import { supabaseAdmin } from './supabase'
import { sendEmail } from './email'

const TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes
const SESSION_TTL_DAYS = 30
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 5

const JWT_AUDIENCE = 'voiceai-dashboard'

function jwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET must be set (>= 32 chars) for session signing')
  }
  return new TextEncoder().encode(s)
}

export interface IssueInput {
  email: string
  nextUrl?: string
  agencyId?: string | null
  origin?: string
  ip?: string | null
  userAgent?: string | null
}

export interface IssueResult {
  /** True iff an email was actually queued (false on rate-limit silent-accept). */
  sent: boolean
  /** Total tokens issued for this email in the rate-limit window (after this call). */
  recentCount: number
}

export async function issueMagicLink(input: IssueInput): Promise<IssueResult> {
  const email = input.email.trim().toLowerCase()
  if (!email || !email.includes('@')) {
    throw new Error('invalid_email')
  }

  // Rate-limit window check.
  const windowSinceIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { count } = await supabaseAdmin
    .from('login_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('email', email)
    .gte('created_at', windowSinceIso)
  const recentCount = (count ?? 0) + 1

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return { sent: false, recentCount }
  }

  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
  const nextUrl = input.nextUrl ?? '/dashboard/agency'

  const { error } = await supabaseAdmin.from('login_tokens').insert({
    email,
    token,
    user_id: email, // v1.0 — will become a real users.id FK in v1.x
    agency_id: input.agencyId ?? null,
    next_url: nextUrl,
    expires_at: expiresAt.toISOString(),
    ip: input.ip ?? null,
    user_agent: input.userAgent ?? null,
  })
  if (error) throw new Error(`magic-link insert failed: ${error.message}`)

  const origin = input.origin ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const link = `${origin}/login/verify?token=${encodeURIComponent(token)}`

  await sendEmail({
    to: email,
    subject: 'Your sign-in link',
    html: renderEmailHtml({ link }),
  }).catch(err => {
    // Log but don't surface — the token is already persisted, the user
    // can request another if the first email failed.
    console.error('[magic-link] sendEmail failed:', err?.message ?? err)
  })

  return { sent: true, recentCount }
}

function renderEmailHtml({ link }: { link: string }): string {
  return `<!doctype html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f7f9;padding:24px;">
<div style="max-width:480px;margin:0 auto;background:#fff;padding:24px;border-radius:8px;">
  <h1 style="font-size:20px;margin:0 0 12px;">Sign in</h1>
  <p style="font-size:14px;color:#444;margin:0 0 16px;">
    Click the button below to sign in. The link expires in 15 minutes and can be used once.
  </p>
  <a href="${link}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">
    Sign in →
  </a>
  <p style="font-size:12px;color:#888;margin:16px 0 0;">
    If the button doesn't work, paste this URL into your browser:<br/>
    <span style="word-break:break-all;">${link}</span>
  </p>
  <p style="font-size:11px;color:#aaa;margin:16px 0 0;">
    Didn't request this? You can safely ignore this email.
  </p>
</div>
</body></html>`
}

export interface VerifyResult {
  ok: boolean
  reason?: 'invalid' | 'expired' | 'already_used'
  email?: string
  userId?: string
  agencyId?: string | null
  nextUrl?: string
  /** JWT to set as the auth_token cookie. */
  sessionToken?: string
}

export async function verifyMagicLink(token: string): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: 'invalid' }

  const { data: row } = await supabaseAdmin
    .from('login_tokens')
    .select('id, email, user_id, agency_id, next_url, expires_at, used_at')
    .eq('token', token)
    .maybeSingle()
  if (!row) return { ok: false, reason: 'invalid' }
  if ((row as any).used_at) return { ok: false, reason: 'already_used' }
  if (new Date((row as any).expires_at).getTime() < Date.now()) {
    return { ok: false, reason: 'expired' }
  }

  // Mark used BEFORE issuing the JWT — single-use guarantee even if
  // the JWT mint races with another verify.
  const { data: updated, error } = await supabaseAdmin
    .from('login_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('id', (row as any).id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, reason: 'invalid' }
  if (!updated) return { ok: false, reason: 'already_used' }

  const sessionToken = await new SignJWT({
    sub: (row as any).user_id,
    email: (row as any).email,
    agency_id: (row as any).agency_id ?? null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .setAudience(JWT_AUDIENCE)
    .sign(jwtSecret())

  return {
    ok: true,
    email: (row as any).email,
    userId: (row as any).user_id,
    agencyId: (row as any).agency_id ?? null,
    nextUrl: (row as any).next_url,
    sessionToken,
  }
}

export interface SessionClaims {
  sub: string
  email: string
  agency_id: string | null
}

export async function readSession(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, jwtSecret(), {
      audience: JWT_AUDIENCE,
    })
    return {
      sub: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      agency_id: (payload as any).agency_id ?? null,
    }
  } catch {
    return null
  }
}

export const SESSION_COOKIE = 'auth_token'
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60
