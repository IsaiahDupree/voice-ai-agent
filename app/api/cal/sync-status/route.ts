import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { calcomClient } from '@/lib/calcom'

// F0337: GET /api/cal/sync-status - Get Cal.com sync status for dashboard
export async function GET(request: NextRequest) {
  try {
    const syncStartTime = Date.now()

    // Check Cal.com health
    let calcomHealthy = false
    let calcomError = null

    try {
      const healthResult = await calcomClient.healthCheck()
      calcomHealthy = healthResult.healthy
    } catch (error: any) {
      calcomError = error.message
      calcomHealthy = false
    }

    // Get last sync time and status
    const { data: syncStatus, error: syncError } = await supabaseAdmin
      .from('calcom_sync_status')
      .select('*')
      .order('synced_at', { ascending: false })
      .limit(1)
      .single()

    const lastSyncTime = syncStatus?.synced_at ? new Date(syncStatus.synced_at) : null
    const lastSyncDurationMs = syncStatus?.sync_duration_ms
    const lastSyncError = syncStatus?.error_message

    // Calculate time since last sync
    const timeSinceLastSync = lastSyncTime
      ? Math.floor((Date.now() - lastSyncTime.getTime()) / 1000) // in seconds
      : null

    // Get event type count for sync coverage
    const { count: eventTypeCount } = await supabaseAdmin
      .from('voice_agent_personas')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      success: true,
      sync_status: {
        healthy: calcomHealthy,
        last_sync: lastSyncTime?.toISOString() || null,
        time_since_last_sync_seconds: timeSinceLastSync,
        last_sync_duration_ms: lastSyncDurationMs,
        synced_event_types: eventTypeCount || 0,
      },
      calcom_status: {
        healthy: calcomHealthy,
        error: calcomError,
      },
      last_error: lastSyncError || null,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Error checking sync status:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to check sync status',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

// F0337: POST /api/cal/sync-status - Record sync status after calendar update
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      syncDurationMs,
      eventTypesSynced,
      errorMessage,
      status = 'success',
    } = body

    // Record sync status
    const { data: record, error: recordError } = await supabaseAdmin
      .from('calcom_sync_status')
      .insert({
        status,
        sync_duration_ms: syncDurationMs,
        event_types_synced: eventTypesSynced || 0,
        error_message: errorMessage || null,
        synced_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (recordError) {
      throw recordError
    }

    return NextResponse.json({
      success: true,
      message: 'Sync status recorded',
      sync_record: record,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error recording sync status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to record sync status' },
      { status: 500 }
    )
  }
}
