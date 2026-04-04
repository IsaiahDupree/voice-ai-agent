// F0501: Transcript ingestion queue - queue transcript processing jobs for reliability
// Failed processing retried from queue

import { supabaseAdmin } from './supabase'

export interface TranscriptQueueJob {
  id: string
  callId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  attempts: number
  maxAttempts: number
  lastError?: string
  deepgramResponse?: any
  createdAt: string
  processedAt?: string
}

/**
 * F0501: Add transcript to processing queue
 */
export async function enqueueTranscriptProcessing(
  callId: string,
  deepgramResponse: any
): Promise<string> {
  try {
    // Check if already queued
    const { data: existing } = await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .select('id')
      .eq('call_id', callId)
      .single()

    if (existing) {
      console.log(`[Transcript Queue] Job already exists for call ${callId}`)
      return existing.id
    }

    // Insert new job
    const { data: job, error } = await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .insert({
        call_id: callId,
        status: 'pending',
        attempts: 0,
        max_attempts: 3,
        deepgram_response: deepgramResponse,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Transcript Queue] Error enqueueing job:', error)
      throw error
    }

    console.log(`[Transcript Queue] Enqueued job ${job.id} for call ${callId}`)
    return job.id
  } catch (error) {
    console.error('[Transcript Queue] Error in enqueueTranscriptProcessing:', error)
    throw error
  }
}

/**
 * F0501: Get next pending job from queue
 */
export async function getNextTranscriptJob(): Promise<TranscriptQueueJob | null> {
  try {
    // Get oldest pending job with attempts < max_attempts
    const { data: jobs, error } = await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lt('attempts', 3) // max_attempts
      .order('created_at', { ascending: true })
      .limit(1)

    if (error) {
      console.error('[Transcript Queue] Error fetching next job:', error)
      return null
    }

    if (!jobs || jobs.length === 0) {
      return null
    }

    const job = jobs[0]

    // Mark as processing
    await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .update({
        status: 'processing',
        attempts: job.attempts + 1,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    return {
      id: job.id,
      callId: job.call_id,
      status: 'processing',
      attempts: job.attempts + 1,
      maxAttempts: job.max_attempts || 3,
      lastError: job.last_error,
      deepgramResponse: job.deepgram_response,
      createdAt: job.created_at,
    }
  } catch (error) {
    console.error('[Transcript Queue] Error in getNextTranscriptJob:', error)
    return null
  }
}

/**
 * F0501: Mark job as completed
 */
export async function completeTranscriptJob(jobId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .update({
        status: 'completed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    console.log(`[Transcript Queue] Completed job ${jobId}`)
  } catch (error) {
    console.error('[Transcript Queue] Error completing job:', error)
    throw error
  }
}

/**
 * F0501: Mark job as failed
 */
export async function failTranscriptJob(jobId: string, error: string): Promise<void> {
  try {
    // Get current job to check attempts
    const { data: job } = await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .select('attempts, max_attempts')
      .eq('id', jobId)
      .single()

    const attempts = job?.attempts || 0
    const maxAttempts = job?.max_attempts || 3

    // If max attempts reached, mark as failed permanently
    const status = attempts >= maxAttempts ? 'failed' : 'pending'

    await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .update({
        status,
        last_error: error,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    console.log(
      `[Transcript Queue] Failed job ${jobId} (attempt ${attempts}/${maxAttempts}): ${error}`
    )
  } catch (error) {
    console.error('[Transcript Queue] Error failing job:', error)
    throw error
  }
}

/**
 * F0501: Process transcript queue
 * Call this from a cron job or worker process
 */
export async function processTranscriptQueue(): Promise<{
  processed: number
  succeeded: number
  failed: number
}> {
  console.log('[Transcript Queue] Starting queue processing...')

  let processed = 0
  let succeeded = 0
  let failed = 0

  try {
    // Process up to 10 jobs per run
    for (let i = 0; i < 10; i++) {
      const job = await getNextTranscriptJob()

      if (!job) {
        // No more jobs in queue
        break
      }

      processed++

      try {
        // Process the transcript
        // Import here to avoid circular deps
        const { parseMultiChannelTranscript } = await import('./transcript-channels')
        const { analyzeTranscriptFull } = await import('./transcript-processing')

        const transcript = parseMultiChannelTranscript(
          job.deepgramResponse,
          new Date().toISOString()
        )

        // Get plain text for analysis
        const { transcriptToText } = await import('./transcript-channels')
        const plainText = transcriptToText(transcript, { includeSpeaker: true })

        // Analyze transcript
        const analysis = await analyzeTranscriptFull(plainText)

        // Store in database
        await supabaseAdmin
          .from('transcripts')
          .upsert({
            call_id: job.callId,
            content: job.deepgramResponse,
            segments: transcript.merged,
            metadata: {
              channels: transcript.channels,
              sentiment: analysis.overallSentiment,
              summary: analysis.summary,
              actionItems: analysis.actionItems,
            },
          })

        // Update call record with analysis
        await supabaseAdmin
          .from('voice_agent_calls')
          .update({
            transcript: plainText,
            sentiment: analysis.overallSentiment,
          })
          .eq('call_id', job.callId)

        // Mark job as completed
        await completeTranscriptJob(job.id)
        succeeded++

        console.log(`[Transcript Queue] Successfully processed job ${job.id}`)
      } catch (error: any) {
        console.error(`[Transcript Queue] Error processing job ${job.id}:`, error)
        await failTranscriptJob(job.id, error.message)
        failed++
      }
    }

    console.log(
      `[Transcript Queue] Processed ${processed} jobs: ${succeeded} succeeded, ${failed} failed`
    )

    return { processed, succeeded, failed }
  } catch (error) {
    console.error('[Transcript Queue] Error in processTranscriptQueue:', error)
    return { processed, succeeded, failed }
  }
}

/**
 * F0501: Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number
  processing: number
  completed: number
  failed: number
}> {
  try {
    const { data: stats } = await supabaseAdmin.rpc('get_transcript_queue_stats')

    if (stats) {
      return stats
    }

    // Fallback: manual count
    const { data: pending } = await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .select('id')
      .eq('status', 'pending')

    const { data: processing } = await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .select('id')
      .eq('status', 'processing')

    const { data: completed } = await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .select('id')
      .eq('status', 'completed')

    const { data: failed } = await supabaseAdmin
      .from('voice_agent_transcript_queue')
      .select('id')
      .eq('status', 'failed')

    return {
      pending: (pending as any)?.count || 0,
      processing: (processing as any)?.count || 0,
      completed: (completed as any)?.count || 0,
      failed: (failed as any)?.count || 0,
    }
  } catch (error) {
    console.error('[Transcript Queue] Error getting queue stats:', error)
    return { pending: 0, processing: 0, completed: 0, failed: 0 }
  }
}
