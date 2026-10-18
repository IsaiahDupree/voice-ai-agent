import { NextRequest, NextResponse } from 'next/server'
import { exportPack } from '@/lib/packs/import-export'

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const bundle = await exportPack(params.slug)
  if (!bundle) return NextResponse.json({ error: 'pack not found' }, { status: 404 })
  return NextResponse.json(bundle)
}
