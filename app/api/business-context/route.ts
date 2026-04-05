/**
 * GET /api/business-context — Vapi tool endpoint (returns compact ContextResponse)
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { compressToBrief, type BusinessProfile } from '@/lib/business-context'

export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain')

  if (!domain) {
    return NextResponse.json({ error: 'Missing domain query parameter' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('business_profiles')
    .select('profile, status')
    .eq('domain', domain)
    .single()

  if (error || !data || data.status !== 'ready') {
    return NextResponse.json(
      { error: 'Not found', domain },
      { status: 404 }
    )
  }

  const profile = data.profile as BusinessProfile
  const context = compressToBrief(profile)

  return NextResponse.json(context, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
