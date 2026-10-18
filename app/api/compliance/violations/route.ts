import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams
  const tenantId = params.get('tenantId')
  const severity = params.get('severity')
  const rule = params.get('rule')
  const since = params.get('since')
  const limit = Math.min(parseInt(params.get('limit') ?? '100', 10), 500)

  let query = supabaseAdmin
    .from('compliance_violations')
    .select(
      'id, call_id, tenant_id, pack_install_id, compliance_profile_slug, rule, matched_phrase, redacted_utterance, severity, source, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (tenantId) query = query.eq('tenant_id', tenantId)
  if (severity) query = query.eq('severity', severity)
  if (rule) query = query.eq('rule', rule)
  if (since) query = query.gte('created_at', since)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Aggregate counts for the dashboard summary.
  const summary: Record<string, number> = {}
  const byRule: Record<string, number> = {}
  for (const row of (data ?? []) as any[]) {
    summary[row.severity] = (summary[row.severity] ?? 0) + 1
    byRule[row.rule] = (byRule[row.rule] ?? 0) + 1
  }

  return NextResponse.json({ violations: data ?? [], summary, byRule })
}
