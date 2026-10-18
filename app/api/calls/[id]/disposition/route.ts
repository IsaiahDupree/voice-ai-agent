import { NextRequest, NextResponse } from 'next/server'
import {
  DISPOSITION_CODES,
  applyDisposition,
  getDisposition,
} from '@/lib/disposition-codes'

export async function GET() {
  return NextResponse.json({ codes: DISPOSITION_CODES })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}))
  const code = String(body.code ?? '').trim()
  if (!code) {
    return NextResponse.json({ error: 'code is required' }, { status: 400 })
  }
  if (!getDisposition(code)) {
    return NextResponse.json({ error: `Unknown disposition code: ${code}` }, { status: 400 })
  }

  try {
    await applyDisposition({
      callId: params.id,
      code,
      notes: body.notes,
      setBy: body.setBy ?? 'api',
    })
    return NextResponse.json({ ok: true, code: code.toUpperCase() })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'failed' }, { status: 500 })
  }
}
