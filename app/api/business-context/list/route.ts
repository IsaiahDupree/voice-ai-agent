/**
 * GET /api/business-context/list — List all business profiles (for dashboard)
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('business_profiles')
    .select('id, domain, company_name, status, profile, brief, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch businesses' }, { status: 500 })
  }

  return NextResponse.json({ businesses: data || [] })
}
