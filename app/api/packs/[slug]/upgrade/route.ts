import { NextRequest, NextResponse } from 'next/server'
import { upgradeInstall } from '@/lib/packs/upgrade'

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const body = await req.json().catch(() => ({}))
  const tenantId = String(body.tenantId ?? '')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
  }
  try {
    const result = await upgradeInstall({ tenantId, packSlug: params.slug })
    const code = result.status === 'active' ? 200 : 202
    return NextResponse.json(result, { status: code })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'failed' }, { status: 500 })
  }
}
