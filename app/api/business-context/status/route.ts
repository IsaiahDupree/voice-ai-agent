/**
 * GET /api/business-context/status — Poll crawl job status
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId query parameter' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('business_profiles')
    .select('id, status, error_message, updated_at')
    .eq('id', jobId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({
    jobId: data.id,
    status: data.status,
    ...(data.error_message ? { error: data.error_message } : {}),
  })
}
