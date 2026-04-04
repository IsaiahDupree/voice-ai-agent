/**
 * Transcript Processing Error Handler
 * Handles Deepgram and transcript processing failures
 * Feature: F1302 (Transcript processing failure)
 */

import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin;

export interface TranscriptError {
  callId: string;
  errorType: 'deepgram_failure' | 'processing_failure' | 'storage_failure' | 'timeout';
  errorMessage: string;
  audioUrl?: string;
  context?: Record<string, any>;
}

export interface TranscriptProcessingResult {
  success: boolean;
  transcriptId?: string;
  error?: string;
  logged: boolean;
}

/**
 * Handle transcript processing error
 */
export async function handleTranscriptError(
  error: TranscriptError
): Promise<{ logged: boolean; retryScheduled: boolean }> {
  const results = {
    logged: false,
    retryScheduled: false,
  };

  try {
    // 1. Log the error
    await logTranscriptError(error);
    results.logged = true;

    // 2. Update call record with error status
    await updateCallRecordWithError(error);

    // 3. Schedule retry if appropriate
    if (shouldRetry(error)) {
      await scheduleTranscriptRetry(error);
      results.retryScheduled = true;
    }

    // 4. Send alert if critical
    if (isCriticalError(error)) {
      await sendTranscriptErrorAlert(error);
    }

    return results;
  } catch (err) {
    console.error('Failed to handle transcript error:', err);
    return results;
  }
}

/**
 * Log transcript error to database
 */
async function logTranscriptError(error: TranscriptError): Promise<void> {
  const { error: logError } = await supabase.from('transcript_errors').insert({
    call_id: error.callId,
    error_type: error.errorType,
    error_message: error.errorMessage,
    audio_url: error.audioUrl,
    context: error.context || {},
    occurred_at: new Date().toISOString(),
  });

  if (logError) {
    console.error('Failed to log transcript error:', logError);
  }
}

/**
 * Update call record with error status
 */
async function updateCallRecordWithError(error: TranscriptError): Promise<void> {
  const { error: updateError } = await supabase
    .from('call_logs')
    .update({
      transcript_status: 'error',
      transcript_error: {
        type: error.errorType,
        message: error.errorMessage,
        occurred_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', error.callId);

  if (updateError) {
    console.error('Failed to update call record:', updateError);
  }
}

/**
 * Determine if error is retryable
 */
function shouldRetry(error: TranscriptError): boolean {
  // Retry on transient errors
  const retryableTypes = ['deepgram_failure', 'timeout'];
  return retryableTypes.includes(error.errorType);
}

/**
 * Determine if error is critical
 */
function isCriticalError(error: TranscriptError): boolean {
  // Alert on persistent failures or storage issues
  return error.errorType === 'storage_failure';
}

/**
 * Schedule transcript retry
 */
async function scheduleTranscriptRetry(error: TranscriptError): Promise<void> {
  // Get current retry count
  const { data: errorLog } = await supabase
    .from('transcript_errors')
    .select('context')
    .eq('call_id', error.callId)
    .order('occurred_at', { ascending: false })
    .limit(5);

  const retryCount = errorLog?.length || 0;
  const maxRetries = 3;

  if (retryCount >= maxRetries) {
    console.log(`Max retries (${maxRetries}) reached for call ${error.callId}`);
    await markTranscriptPermanentFailure(error.callId);
    return;
  }

  // Calculate retry delay (exponential backoff: 5min, 15min, 30min)
  const delays = [5, 15, 30];
  const delayMinutes = delays[Math.min(retryCount, delays.length - 1)];
  const retryAt = new Date();
  retryAt.setMinutes(retryAt.getMinutes() + delayMinutes);

  const { error: queueError } = await supabase.from('transcript_retry_queue').insert({
    call_id: error.callId,
    audio_url: error.audioUrl,
    retry_count: retryCount + 1,
    retry_at: retryAt.toISOString(),
    error_type: error.errorType,
    status: 'pending',
    created_at: new Date().toISOString(),
  });

  if (queueError) {
    console.error('Failed to schedule transcript retry:', queueError);
  } else {
    console.log(`Scheduled transcript retry for call ${error.callId} at ${retryAt.toISOString()}`);
  }
}

/**
 * Mark transcript as permanent failure
 */
async function markTranscriptPermanentFailure(callId: string): Promise<void> {
  await supabase
    .from('call_logs')
    .update({
      transcript_status: 'permanent_failure',
      updated_at: new Date().toISOString(),
    })
    .eq('id', callId);
}

/**
 * Send alert for critical transcript error
 */
async function sendTranscriptErrorAlert(error: TranscriptError): Promise<void> {
  const { data: call } = await supabase
    .from('call_logs')
    .select('phone_number, duration, started_at')
    .eq('id', error.callId)
    .single();

  const subject = 'Critical Transcript Processing Error';
  const body = `
A critical error occurred while processing a call transcript.

Call ID: ${error.callId}
Error Type: ${error.errorType}
Error Message: ${error.errorMessage}

${call ? `
Call Details:
- Phone: ${call.phone_number}
- Duration: ${call.duration}s
- Started: ${call.started_at}
` : ''}

Please investigate immediately as this may indicate a storage or infrastructure issue.

Dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/calls/${error.callId}
  `.trim();

  // Get admin emails
  const { data: admins } = await supabase
    .from('users')
    .select('email, name')
    .eq('role', 'admin');

  if (!admins || admins.length === 0) {
    console.warn('No admin users found for transcript error alerting');
    return;
  }

  // Queue alert emails
  const emailPayloads = admins.map((admin) => ({
    to: admin.email,
    to_name: admin.name,
    subject,
    body,
    alert_type: 'transcript_error',
    call_id: error.callId,
    created_at: new Date().toISOString(),
  }));

  await supabase.from('email_queue').insert(emailPayloads);
}

/**
 * Process transcript retry queue
 */
export async function processTranscriptRetryQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date().toISOString();

  const { data: retries, error } = await supabase
    .from('transcript_retry_queue')
    .select('*')
    .lte('retry_at', now)
    .eq('status', 'pending')
    .limit(10);

  if (error || !retries) {
    console.error('Failed to fetch transcript retry queue:', error);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const retry of retries) {
    try {
      // Attempt to reprocess transcript
      const result = await reprocessTranscript(retry.call_id, retry.audio_url);

      if (result.success) {
        // Mark as processed
        await supabase
          .from('transcript_retry_queue')
          .update({
            status: 'processed',
            processed_at: new Date().toISOString(),
          })
          .eq('id', retry.id);

        // Update call record
        await supabase
          .from('call_logs')
          .update({
            transcript_status: 'completed',
            transcript_id: result.transcriptId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', retry.call_id);

        succeeded++;
      } else {
        // Retry failed, will be re-scheduled by handleTranscriptError
        await handleTranscriptError({
          callId: retry.call_id,
          errorType: 'processing_failure',
          errorMessage: result.error || 'Retry failed',
          audioUrl: retry.audio_url,
        });

        failed++;
      }
    } catch (err) {
      console.error(`Failed to process transcript retry ${retry.id}:`, err);
      failed++;
    }
  }

  return {
    processed: retries.length,
    succeeded,
    failed,
  };
}

/**
 * Reprocess transcript
 */
async function reprocessTranscript(
  callId: string,
  audioUrl: string
): Promise<{ success: boolean; transcriptId?: string; error?: string }> {
  try {
    // Call Deepgram API to transcribe
    const response = await fetch('https://api.deepgram.com/v1/listen', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: audioUrl,
        model: 'nova-2',
        punctuate: true,
        diarize: true,
        smart_format: true,
      }),
      signal: AbortSignal.timeout(60000), // 60 second timeout
    });

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.status}`);
    }

    const result = await response.json();
    const transcript = result.results?.channels[0]?.alternatives[0]?.transcript || '';

    if (!transcript) {
      throw new Error('No transcript returned from Deepgram');
    }

    // Save transcript to database
    const { data: transcriptRecord, error: saveError } = await supabase
      .from('transcripts')
      .insert({
        call_id: callId,
        transcript_text: transcript,
        deepgram_response: result,
        provider: 'deepgram',
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (saveError || !transcriptRecord) {
      throw new Error('Failed to save transcript');
    }

    return {
      success: true,
      transcriptId: transcriptRecord.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get transcript error stats
 */
export async function getTranscriptErrorStats(hours: number = 24): Promise<{
  totalErrors: number;
  byType: Record<string, number>;
  pendingRetries: number;
  permanentFailures: number;
}> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const [errors, retries, failures] = await Promise.all([
    supabase
      .from('transcript_errors')
      .select('error_type')
      .gte('occurred_at', since.toISOString()),

    supabase
      .from('transcript_retry_queue')
      .select('id')
      .eq('status', 'pending'),

    supabase
      .from('call_logs')
      .select('id')
      .eq('transcript_status', 'permanent_failure')
      .gte('updated_at', since.toISOString()),
  ]);

  const errorData = errors.data || [];
  const byType: Record<string, number> = {};

  errorData.forEach((e) => {
    byType[e.error_type] = (byType[e.error_type] || 0) + 1;
  });

  return {
    totalErrors: errorData.length,
    byType,
    pendingRetries: retries.count || 0,
    permanentFailures: failures.count || 0,
  };
}
