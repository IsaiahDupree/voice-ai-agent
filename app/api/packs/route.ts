import { NextRequest, NextResponse } from 'next/server'
import { listAvailablePacks, listTenantInstalls } from '@/lib/packs/installer'

export async function GET(req: NextRequest) {
  const tenantId = req.nextUrl.searchParams.get('tenantId')
  const [packs, installs] = await Promise.all([
    listAvailablePacks(),
    tenantId ? listTenantInstalls(tenantId) : Promise.resolve([]),
  ])
  return NextResponse.json({ packs, installs })
}
