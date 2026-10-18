/**
 * Per-install integration credentials.
 *
 * GET    — does NOT return raw values; returns the configured slugs +
 *          which keys are populated (true/false) so the UI can show a
 *          checklist without ever exposing secrets to the client.
 * PUT    — encrypt + persist the supplied bag.
 * DELETE — clear the install's credentials.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import {
  saveCredentialsForInstall,
  loadCredentialsForInstall,
  type CredentialBag,
} from '@/lib/packs/credentials'

async function findInstall(tenantId: string, packSlug: string): Promise<string | null> {
  const { data: pack } = await supabaseAdmin
    .from('industry_packs')
    .select('id')
    .eq('slug', packSlug)
    .maybeSingle()
  if (!pack) return null
  const { data } = await supabaseAdmin
    .from('tenant_pack_installs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('pack_id', (pack as any).id)
    .maybeSingle()
  return (data as any)?.id ?? null
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  const installId = await findInstall(tenantId, params.slug)
  if (!installId) return NextResponse.json({ error: 'install not found' }, { status: 404 })

  const bag = await loadCredentialsForInstall(installId)
  const summary: Record<string, Record<string, boolean>> = {}
  for (const [provider, kv] of Object.entries(bag)) {
    summary[provider] = Object.fromEntries(Object.entries(kv).map(([k, v]) => [k, !!v]))
  }
  return NextResponse.json({ installId, configured: summary })
}

export async function PUT(req: NextRequest, { params }: { params: { slug: string } }) {
  const body = await req.json().catch(() => ({}))
  const tenantId = String(body.tenantId ?? '')
  const credentials = body.credentials as CredentialBag | undefined
  if (!tenantId || !credentials) {
    return NextResponse.json({ error: 'tenantId and credentials required' }, { status: 400 })
  }
  const installId = await findInstall(tenantId, params.slug)
  if (!installId) return NextResponse.json({ error: 'install not found' }, { status: 404 })

  const result = await saveCredentialsForInstall(installId, credentials)
  if (!result.saved) return NextResponse.json({ error: result.reason }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { slug: string } }) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) return NextResponse.json({ error: 'tenantId required' }, { status: 400 })
  const installId = await findInstall(tenantId, params.slug)
  if (!installId) return NextResponse.json({ error: 'install not found' }, { status: 404 })

  const { error } = await supabaseAdmin
    .from('tenant_pack_installs')
    .update({ integration_credentials_enc: null, integration_credentials_kid: null })
    .eq('id', installId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
