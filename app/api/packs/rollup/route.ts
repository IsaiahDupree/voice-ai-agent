import { NextRequest, NextResponse } from 'next/server'
import { rollupForTenant } from '@/lib/packs/outcomes'

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  if (!tenantId) {
    return NextResponse.json({ error: 'tenantId is required' }, { status: 400 })
  }
  const since = req.nextUrl.searchParams.get('since') ?? undefined
  const rollups = await rollupForTenant(tenantId, since)
  return NextResponse.json({ rollups })
}
