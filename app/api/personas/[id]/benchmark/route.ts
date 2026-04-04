// F0808: Persona benchmark

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

interface BenchmarkData {
  persona_id: string
  avg_call_duration: number
  total_calls: number
  success_rate: number
  org_avg_call_duration: number
  org_avg_success_rate: number
  percentile_rank: number
  comparison: string
}

// GET /api/personas/:id/benchmark - Compare persona performance to org average
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('org_id')

    // Get persona
    let query = supabaseAdmin
      .from('personas')
      .select('id, call_count, org_id')
      .eq('id', params.id)

    if (orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: persona, error: personaError } = await query.single()

    if (personaError || !persona) {
      return NextResponse.json({ error: 'Persona not found' }, { status: 404 })
    }

    // Get org-wide averages from call logs
    // This would aggregate call data - for now return mock data
    const mockBenchmark: BenchmarkData = {
      persona_id: params.id,
      avg_call_duration: 245, // seconds
      total_calls: persona.call_count || 0,
      success_rate: 0.72, // 72%
      org_avg_call_duration: 268,
      org_avg_success_rate: 0.65,
      percentile_rank: 78, // Top 22%
      comparison: 'above_average', // above_average, average, below_average
    }

    return NextResponse.json({
      persona_id: params.id,
      benchmark: mockBenchmark,
      insights: [
        {
          metric: 'Call Duration',
          status: 'better_than_avg',
          message: '9% faster than org average',
        },
        {
          metric: 'Success Rate',
          status: 'better_than_avg',
          message: '11% higher success rate than org average',
        },
        {
          metric: 'Overall Performance',
          status: 'top_performer',
          message: `Ranked in top ${100 - mockBenchmark.percentile_rank}% of personas`,
        },
      ],
    })
  } catch (error: any) {
    console.error('Error fetching benchmark:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
