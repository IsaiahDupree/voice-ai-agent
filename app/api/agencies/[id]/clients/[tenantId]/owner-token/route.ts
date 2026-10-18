/**
 * /api/agencies/[id]/clients/[tenantId]/owner-token
 *
 * GET    list active tokens for this client (agency view).
 * POST   issue a new token.   Body: { recipientEmail?, label?, allowTranscripts? }
 * DELETE revoke a token.       Query: ?tokenId=...&reason=...
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { issueOwnerToken, revokeOwnerToken } from '@/lib/owner-portal'

async function tenantBelongsToAgency(agencyId: string, tenantId: string) {
  const { data } = await supabaseAdmin
    .from('tenants')
    .select('id, agency_id')
    .eq('id', tenantId)
    .maybeSingle()
  return data && data.agency_id === agencyId
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; tenantId: string } },
) {
  if (!(await tenantBelongsToAgency(params.id, params.tenantId))) {
    return NextResponse.json({ error: 'tenant_not_in_agency' }, { status: 403 })
  }
  const { data, error } = await supabaseAdmin
    .from('owner_portal_tokens')
    .select(
      'id, token, recipient_email, recipient_name, label, parent_id, expires_at, revoked_at, allow_transcripts, last_accessed_at, access_count, created_at',
    )
    .eq('tenant_id', params.tenantId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tokens: data ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; tenantId: string } },
) {
  if (!(await tenantBelongsToAgency(params.id, params.tenantId))) {
    return NextResponse.json({ error: 'tenant_not_in_agency' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  try {
    const row = await issueOwnerToken({
      tenantId: params.tenantId,
      recipientEmail: body.recipientEmail ?? null,
      recipientName: body.recipientName ?? null,
      label: body.label ?? null,
      allowTranscripts: body.allowTranscripts === true,
      ttlDays: typeof body.ttlDays === 'number' ? body.ttlDays : undefined,
    })
    return NextResponse.json({ token: row })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'issue_failed' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; tenantId: string } },
) {
  if (!(await tenantBelongsToAgency(params.id, params.tenantId))) {
    return NextResponse.json({ error: 'tenant_not_in_agency' }, { status: 403 })
  }
  const tokenId = req.nextUrl.searchParams.get('tokenId')
  const reason = req.nextUrl.searchParams.get('reason') ?? 'agency_revoked'
  if (!tokenId) return NextResponse.json({ error: 'tokenId required' }, { status: 400 })
  await revokeOwnerToken(tokenId, reason)
  return NextResponse.json({ ok: true })
}
