/**
 * Preview a digest for a tenant — no email sent. Returns subject + html
 * + text + payload so the dashboard can show what an SMB owner will get.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { buildDigestPayload, renderDigest } from '@/lib/owner-digest'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  const frequency =
    (req.nextUrl.searchParams.get('frequency') as 'daily' | 'weekly') ?? 'weekly'
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  }
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, agency_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant || tenant.agency_id !== params.id) {
    return NextResponse.json({ error: 'tenant_not_in_agency' }, { status: 403 })
  }

  const payload = await buildDigestPayload({ tenantId, frequency })
  if (!payload) return NextResponse.json({ error: 'tenant_not_found' }, { status: 404 })

  const rendered = renderDigest({ payload, frequency })
  return NextResponse.json(rendered)
}
