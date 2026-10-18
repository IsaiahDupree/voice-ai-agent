/**
 * /api/agencies/[id]/clients — agency's SMB client roster + KPIs.
 *
 * GET  → list with rolled-up KPIs (last 30d by default; ?since=ISO).
 * POST → provision a new client tenant under this agency. Optionally
 *        installs an industry pack at the same time.
 */

import { NextRequest, NextResponse } from 'next/server'
import { listClientsWithKpis, provisionClient } from '@/lib/agency'
import { installPack } from '@/lib/packs/installer'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const since = req.nextUrl.searchParams.get('since') ?? undefined
  const clients = await listClientsWithKpis(params.id, since)
  return NextResponse.json({ clients })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as Record<string, any>
  const {
    displayName,
    legalName,
    slug,
    packSlug,
    kbValues,
    integrationMap,
    provisionedBy,
    phoneNumbers,
    activate = false,
  } = body

  if (!displayName) {
    return NextResponse.json({ error: 'displayName required' }, { status: 400 })
  }

  const result = await provisionClient({
    agencyId: params.id,
    displayName,
    legalName,
    slug,
    provisionedBy,
    phoneNumbers,
  })
  if ('error' in result) {
    const status = result.error === 'max_clients_reached' ? 402 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  // Optional: install a pack right after provision.
  let packInstall: any = null
  if (packSlug) {
    packInstall = await installPack({
      tenantId: result.tenantId,
      packSlug,
      kbValues: kbValues ?? {},
      integrationMap: integrationMap ?? {},
      activate,
    }).catch((e: any) => ({ error: e.message ?? 'install failed' }))
  }

  return NextResponse.json({
    tenant: { id: result.tenantId, slug: result.slug },
    packInstall,
  })
}
