/**
 * Send a one-off sample digest. Used by the agency to demo the digest
 * to themselves (or a prospective SMB) without setting up a recurring
 * subscription. Tagged status='sample' in digest_sends.
 *
 * body: { tenantId, recipientEmail, frequency? }
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendSampleDigest } from '@/lib/digest-sender'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const { tenantId, recipientEmail, frequency = 'weekly' } = body
  if (!tenantId || !recipientEmail) {
    return NextResponse.json({ error: 'tenantId and recipientEmail required' }, { status: 400 })
  }
  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('id, agency_id')
    .eq('id', tenantId)
    .maybeSingle()
  if (!tenant || tenant.agency_id !== params.id) {
    return NextResponse.json({ error: 'tenant_not_in_agency' }, { status: 403 })
  }

  const result = await sendSampleDigest({
    tenantId,
    recipientEmail,
    frequency: frequency === 'daily' ? 'daily' : 'weekly',
  })
  return NextResponse.json(result)
}
