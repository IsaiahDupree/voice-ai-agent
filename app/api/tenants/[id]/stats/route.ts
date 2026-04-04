/**
 * Feature 135: Per-tenant call stats + conversion metrics
 * GET /api/tenants/:id/stats
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Get comprehensive tenant statistics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    // Verify tenant exists
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('id, name')
      .eq('id', id)
      .single()

    if (tenantError) {
      if (tenantError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Tenant not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: tenantError.message },
        { status: 500 }
      )
    }

    // Build date filter for calls
    let callsQuery = supabaseAdmin
      .from('voice_agent_calls')
      .select('*')
      .eq('tenant_id', id)

    if (startDate) {
      callsQuery = callsQuery.gte('created_at', startDate)
    }
    if (endDate) {
      callsQuery = callsQuery.lte('created_at', endDate)
    }

    const { data: calls, error: callsError } = await callsQuery

    if (callsError) {
      console.error('Error fetching calls:', callsError)
      return NextResponse.json(
        { error: callsError.message },
        { status: 500 }
      )
    }

    // Calculate call statistics
    const totalCalls = calls?.length || 0
    const completedCalls = calls?.filter((c) => c.status === 'completed').length || 0
    const failedCalls = calls?.filter((c) => c.status === 'failed' || c.status === 'busy' || c.status === 'no-answer').length || 0
    const inProgressCalls = calls?.filter((c) => c.status === 'in-progress' || c.status === 'ringing').length || 0

    // Calculate duration statistics (in seconds)
    const callsWithDuration = calls?.filter((c) => c.duration && c.duration > 0) || []
    const totalDuration = callsWithDuration.reduce((sum, c) => sum + (c.duration || 0), 0)
    const avgDuration = callsWithDuration.length > 0 ? totalDuration / callsWithDuration.length : 0

    // Calculate conversion metrics
    const callsWithOutcome = calls?.filter((c) => c.metadata?.outcome) || []
    const successfulCalls = callsWithOutcome.filter(
      (c) => c.metadata?.outcome === 'success' || c.metadata?.outcome === 'appointment_booked'
    ).length
    const conversionRate = callsWithOutcome.length > 0
      ? (successfulCalls / callsWithOutcome.length) * 100
      : 0

    // Get contact statistics
    const { count: contactsCount } = await supabaseAdmin
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id)

    // Get campaign statistics
    const { count: campaignsCount } = await supabaseAdmin
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id)

    // Get knowledge base statistics
    const { count: documentsCount } = await supabaseAdmin
      .from('kb_documents')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id)

    // Get caller memory statistics
    const { count: callerMemoryCount } = await supabaseAdmin
      .from('caller_memory')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', id)

    // Calculate call outcome breakdown
    const outcomeBreakdown = calls?.reduce((acc: Record<string, number>, call) => {
      const outcome = call.metadata?.outcome || 'unknown'
      acc[outcome] = (acc[outcome] || 0) + 1
      return acc
    }, {})

    // Calculate daily call volume (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: recentCalls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('created_at')
      .eq('tenant_id', id)
      .gte('created_at', thirtyDaysAgo.toISOString())

    const dailyVolume = recentCalls?.reduce((acc: Record<string, number>, call) => {
      const date = new Date(call.created_at).toISOString().split('T')[0]
      acc[date] = (acc[date] || 0) + 1
      return acc
    }, {})

    return NextResponse.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
      period: {
        start_date: startDate || 'all-time',
        end_date: endDate || 'now',
      },
      calls: {
        total: totalCalls,
        completed: completedCalls,
        failed: failedCalls,
        in_progress: inProgressCalls,
        completion_rate: totalCalls > 0 ? (completedCalls / totalCalls) * 100 : 0,
      },
      duration: {
        total_seconds: totalDuration,
        total_minutes: totalDuration / 60,
        average_seconds: avgDuration,
        average_minutes: avgDuration / 60,
      },
      conversion: {
        successful_calls: successfulCalls,
        conversion_rate: conversionRate,
        outcome_breakdown: outcomeBreakdown,
      },
      resources: {
        contacts: contactsCount || 0,
        campaigns: campaignsCount || 0,
        kb_documents: documentsCount || 0,
        caller_profiles: callerMemoryCount || 0,
      },
      trends: {
        daily_volume: dailyVolume || {},
      },
    })
  } catch (error: any) {
    console.error('Error in GET /api/tenants/:id/stats:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
