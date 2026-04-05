/**
 * GET /api/business-context/full — Full BusinessProfile for dashboard
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')

  if (!domain) {
    return NextResponse.json({ error: 'Missing domain query parameter' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('business_profiles')
    .select('*')
    .eq('domain', domain)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Not found', domain }, { status: 404 })
  }

  return NextResponse.json(data)
}
