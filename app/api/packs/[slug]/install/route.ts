import { NextRequest, NextResponse } from 'next/server'
import { installPack, uninstallPack, PackInstallError } from '@/lib/packs/installer'

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
    const result = await installPack({
      tenantId,
      packSlug: params.slug,
      kbValues: body.kbValues ?? {},
      integrationMap: body.integrationMap ?? {},
      activate: body.activate !== false,
    })
    const code = result.status === 'active' ? 200 : 202
    return NextResponse.json(result, { status: code })
  } catch (e: any) {
    if (e instanceof PackInstallError) {
      return NextResponse.json({ error: e.message, errors: e.errors }, { status: 400 })
    }
    return NextResponse.json({ error: e.message ?? 'failed' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
  }
  try {
    await uninstallPack(tenantId, params.slug)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'failed' }, { status: 500 })
  }
}
