/**
 * GET /api/owner/[token] — public read-only data feed for the owner
 * portal. Token IS the credential. Returns shaped data the page renders.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyOwnerToken, recordAccess, buildOwnerData } from '@/lib/owner-portal'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const window = Number(req.nextUrl.searchParams.get('windowDays') ?? '7')
  const verify = await verifyOwnerToken(params.token)
  if (!verify.ok) {
    return NextResponse.json({ ok: false, reason: verify.reason }, { status: 404 })
  }
  const data = await buildOwnerData({
    tenantId: verify.row.tenant_id,
    allowTranscripts: verify.row.allow_transcripts,
    windowDays: Math.max(1, Math.min(90, window)),
  })
  if (!data) return NextResponse.json({ ok: false, reason: 'tenant_not_found' }, { status: 404 })

  // Best-effort access telemetry — never block the response.
  recordAccess(verify.row.id).catch(() => undefined)

  return NextResponse.json({ ok: true, data, tokenLabel: verify.row.label })
}
