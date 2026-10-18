import { NextRequest, NextResponse } from 'next/server'
import { importPack, type PackBundle } from '@/lib/packs/import-export'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as PackBundle | null
  if (!body || !body.pack || body.schemaVersion !== '1.0') {
    return NextResponse.json(
      { error: 'invalid bundle (need schemaVersion 1.0 + pack)' },
      { status: 400 },
    )
  }
  try {
    const result = await importPack(body)
    return NextResponse.json(result, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'import failed' }, { status: 500 })
  }
}
