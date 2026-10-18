/**
 * /api/agencies/[id]/digests — manage digest subscriptions for the
 * agency's clients.
 *
 * GET                    list all subscriptions across the agency's tenants
 * POST                   create or update a subscription
 *                        body: { tenantId, recipientEmail, recipientName?,
 *                                frequency, sendHourLocal?, sendDayOfWeek? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { data: tenants } = await supabaseAdmin
    .from('tenants')
    .select('id, display_name, name')
    .eq('agency_id', params.id)
  const ids = (tenants ?? []).map(t => t.id)
  if (ids.length === 0) return NextResponse.json({ subscriptions: [] })

  const { data, error } = await supabaseAdmin
    .from('digest_subscriptions')
    .select('*')
    .in('tenant_id', ids)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const nameById = new Map(
    (tenants ?? []).map(t => [t.id, t.display_name ?? t.name ?? t.id]),
  )
  const enriched = (data ?? []).map((r: any) => ({
    ...r,
    tenant_display_name: nameById.get(r.tenant_id) ?? r.tenant_id,
  }))
  return NextResponse.json({ subscriptions: enriched })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const { tenantId, recipientEmail, recipientName, frequency, sendHourLocal, sendDayOfWeek } = body

  if (!tenantId || !recipientEmail || !frequency) {
    return NextResponse.json(
      { error: 'tenantId, recipientEmail, frequency required' },
      { status: 400 },
    )
  }
  if (!['daily', 'weekly', 'off'].includes(frequency)) {
    return NextResponse.json({ error: 'invalid frequency' }, { status: 400 })
  }

  // Verify tenant belongs to this agency.
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, agency_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant || tenant.agency_id !== params.id) {
    return NextResponse.json({ error: 'tenant_not_in_agency' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('digest_subscriptions')
    .upsert(
      {
        tenant_id: tenantId,
        recipient_email: recipientEmail,
        recipient_name: recipientName ?? null,
        frequency,
        send_hour_local: typeof sendHourLocal === 'number' ? sendHourLocal : 8,
        send_day_of_week: typeof sendDayOfWeek === 'number' ? sendDayOfWeek : 1,
      },
      { onConflict: 'tenant_id,recipient_email' },
    )
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ subscription: data })
}
