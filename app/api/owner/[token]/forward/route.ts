/**
 * POST /api/owner/[token]/forward — SMB owner spawns a child token to
 * forward to their team. Inherits the parent's tenant, agency, and
 * transcript permission; cannot extend lifetime past the parent.
 *
 * Body: { recipientEmail?, label? }
 * Returns: { token } — the *new* opaque token string for the URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { forwardOwnerToken } from '@/lib/owner-portal'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  try {
    const row = await forwardOwnerToken(
      params.token,
      body.recipientEmail ?? null,
      body.label ?? null,
    )
    return NextResponse.json({ token: row.token, expiresAt: row.expires_at })
  } catch (err: any) {
    const msg = err?.message ?? 'forward_failed'
    const reason = msg.startsWith('forward_blocked:') ? msg.split(':')[1] : 'failed'
    return NextResponse.json({ error: reason }, { status: 400 })
  }
}
