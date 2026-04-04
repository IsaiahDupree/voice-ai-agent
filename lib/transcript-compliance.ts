// F0482: Transcript compliance - retention policy enforcement

import { supabaseAdmin } from './supabase'

export interface RetentionPolicy {
  retentionDays: number // Default: 90 days
  archiveOlderThan?: number // Optional: archive before deletion (e.g., 60 days)
  exemptCategories?: string[] // e.g., ['legal_hold', 'dispute']
}

export const defaultRetentionPolicy: RetentionPolicy = {
  retentionDays: 90, // 90 days standard retention
  archiveOlderThan: 60, // Archive after 60 days
  exemptCategories: ['legal_hold', 'dispute', 'compliance_review'],
}

/**
 * F0482: Check if transcript should be retained
 * Returns true if transcript is within retention window or exempt
 */
export async function shouldRetainTranscript(
  callId: string,
  policy: RetentionPolicy = defaultRetentionPolicy
): Promise<{
  shouldRetain: boolean
  reason: string
  daysOld?: number
}> {
  try {
    const { data: transcript } = await supabaseAdmin
      .from('transcripts')
      .select('call_id, created_at')
      .eq('call_id', callId)
      .single()

    if (!transcript) {
      return { shouldRetain: false, reason: 'not_found' }
    }

    // Check call metadata for exemptions
    const { data: call } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('metadata')
      .eq('call_id', callId)
      .single()

    const metadata = call?.metadata as any

    // Check if call is exempt (legal hold, dispute, etc.)
    if (metadata?.retention_exempt || metadata?.legal_hold) {
      return { shouldRetain: true, reason: 'exempt' }
    }

    const category = metadata?.category
    if (category && policy.exemptCategories?.includes(category)) {
      return { shouldRetain: true, reason: 'exempt_category' }
    }

    // Calculate age in days
    const createdAt = new Date(transcript.created_at)
    const now = new Date()
    const ageMs = now.getTime() - createdAt.getTime()
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))

    // Within retention window?
    if (ageDays <= policy.retentionDays) {
      return { shouldRetain: true, reason: 'within_retention', daysOld: ageDays }
    }

    // Expired
    return { shouldRetain: false, reason: 'expired', daysOld: ageDays }
  } catch (error) {
    console.error('[Retention Policy] Error checking retention:', error)
    // Fail-safe: retain on error
    return { shouldRetain: true, reason: 'error' }
  }
}

/**
 * F0482: Delete transcripts older than retention policy
 * Returns count of deleted transcripts
 */
export async function enforceRetentionPolicy(
  policy: RetentionPolicy = defaultRetentionPolicy,
  dryRun: boolean = true
): Promise<{
  deleted: number
  archived: number
  exempt: number
}> {
  console.log(
    `[Retention Policy] Enforcing policy: ${policy.retentionDays} days (dryRun: ${dryRun})`
  )

  try {
    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays)

    // Fetch all transcripts older than cutoff
    const { data: oldTranscripts } = await supabaseAdmin
      .from('transcripts')
      .select('call_id, created_at')
      .lt('created_at', cutoffDate.toISOString())

    if (!oldTranscripts || oldTranscripts.length === 0) {
      console.log('[Retention Policy] No transcripts to delete')
      return { deleted: 0, archived: 0, exempt: 0 }
    }

    let deletedCount = 0
    let archivedCount = 0
    let exemptCount = 0

    // Check each transcript for exemptions
    for (const transcript of oldTranscripts) {
      const { shouldRetain, reason } = await shouldRetainTranscript(
        transcript.call_id,
        policy
      )

      if (shouldRetain) {
        if (reason === 'exempt' || reason === 'exempt_category') {
          exemptCount++
        }
        continue
      }

      // Archive if needed (before deletion)
      if (policy.archiveOlderThan) {
        const archiveCutoff = new Date()
        archiveCutoff.setDate(archiveCutoff.getDate() - policy.archiveOlderThan)

        if (new Date(transcript.created_at) < archiveCutoff) {
          // Archive logic here (e.g., move to cold storage, S3, etc.)
          // For now, just mark as archived in metadata
          if (!dryRun) {
            await supabaseAdmin
              .from('transcripts')
              .update({
                content: { archived: true, archived_at: new Date().toISOString() },
              })
              .eq('call_id', transcript.call_id)
          }
          archivedCount++
        }
      }

      // Delete transcript
      if (!dryRun) {
        await supabaseAdmin.from('transcripts').delete().eq('call_id', transcript.call_id)
      }
      deletedCount++
    }

    console.log(
      `[Retention Policy] Processed ${oldTranscripts.length} transcripts: ${deletedCount} deleted, ${archivedCount} archived, ${exemptCount} exempt`
    )

    return {
      deleted: deletedCount,
      archived: archivedCount,
      exempt: exemptCount,
    }
  } catch (error) {
    console.error('[Retention Policy] Error enforcing policy:', error)
    throw error
  }
}

/**
 * F0482: Mark transcript as exempt from retention policy
 */
export async function exemptTranscriptFromRetention(
  callId: string,
  reason: string = 'manual_exemption'
): Promise<void> {
  try {
    await supabaseAdmin
      .from('voice_agent_calls')
      .update({
        metadata: {
          retention_exempt: true,
          exemption_reason: reason,
          exempted_at: new Date().toISOString(),
        },
      })
      .eq('call_id', callId)

    console.log(`[Retention Policy] Exempted transcript ${callId}: ${reason}`)
  } catch (error) {
    console.error('[Retention Policy] Error exempting transcript:', error)
    throw error
  }
}
