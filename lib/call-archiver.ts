// F1499: Vapi call archive - Archive old calls to cold storage after 90 days
import { supabaseAdmin } from './supabase'

const ARCHIVE_THRESHOLD_DAYS = 90

export async function archiveOldCalls() {
  try {
    const thresholdDate = new Date()
    thresholdDate.setDate(thresholdDate.getDate() - ARCHIVE_THRESHOLD_DAYS)

    // Find calls older than threshold that haven't been archived
    const { data: oldCalls, error: fetchError } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('*')
      .lt('ended_at', thresholdDate.toISOString())
      .eq('archived', false)
      .limit(1000) // Process in batches

    if (fetchError) {
      console.error('Error fetching old calls:', fetchError)
      return { archived: 0, error: fetchError.message }
    }

    if (!oldCalls || oldCalls.length === 0) {
      console.log('No calls to archive')
      return { archived: 0 }
    }

    console.log(`Archiving ${oldCalls.length} old calls`)

    // Move to archive table
    const { error: insertError } = await supabaseAdmin
      .from('voice_agent_calls_archive')
      .insert(
        oldCalls.map((call) => ({
          ...call,
          archived_at: new Date().toISOString(),
        }))
      )

    if (insertError) {
      console.error('Error inserting to archive:', insertError)
      return { archived: 0, error: insertError.message }
    }

    // Mark as archived in main table (don't delete to maintain referential integrity)
    const callIds = oldCalls.map((c) => c.call_id)
    const { error: updateError } = await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        archived: true,
        archived_at: new Date().toISOString(),
      })
      .in('call_id', callIds)

    if (updateError) {
      console.error('Error marking calls as archived:', updateError)
      return { archived: 0, error: updateError.message }
    }

    console.log(`Successfully archived ${oldCalls.length} calls`)
    return { archived: oldCalls.length }
  } catch (error: any) {
    console.error('Call archiving error:', error)
    return { archived: 0, error: error.message }
  }
}

export async function getArchiveStats() {
  try {
    const { data: stats, error } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('archived')
      .eq('archived', true)

    if (error) throw error

    const archivedCount = stats?.length || 0

    const { data: activeStats } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('call_id')
      .eq('archived', false)

    const activeCount = activeStats?.length || 0

    return {
      archived: archivedCount,
      active: activeCount,
      total: archivedCount + activeCount,
    }
  } catch (error: any) {
    console.error('Get archive stats error:', error)
    throw error
  }
}
