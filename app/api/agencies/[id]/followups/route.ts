/**
 * /api/agencies/[id]/followups — recent post-call follow-ups across the
 * agency's clients. The agency uses this to show the SMB exactly what
 * the AI did after each call.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const limit = Math.min(200, Number(req.nextUrl.searchParams.get('limit') ?? 50))
  const status = req.nextUrl.searchParams.get('status') // queued | sent | skipped | failed
  const tenantId = req.nextUrl.searchParams.get('tenantId')

  // Resolve the agency's tenant ids first.
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, display_name, name')
    .eq('agency_id', params.id)

  const tenantIds = (tenants ?? []).map(t => t.id)
  if (tenantIds.length === 0) return NextResponse.json({ followups: [] })

  let q = supabaseAdmin
    .from('post_call_followups')
    .select(
      'id, call_id, tenant_id, pack_slug, next_action, channel, template_name, rendered_body, to_phone, scheduled_for, lead_score, status, skip_reason, created_at',
    )
    .in('tenant_id', tenantId ? [tenantId] : tenantIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) q = q.eq('status', status)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Stitch the tenant display name onto each row so the dashboard
  // doesn't have to re-join.
  const tenantNameById = new Map(
    (tenants ?? []).map(t => [t.id, t.display_name ?? t.name ?? t.id]),
  )
  const enriched = (data ?? []).map((r: any) => ({
    ...r,
    tenant_display_name: tenantNameById.get(r.tenant_id) ?? r.tenant_id,
  }))

  return NextResponse.json({ followups: enriched })
}
