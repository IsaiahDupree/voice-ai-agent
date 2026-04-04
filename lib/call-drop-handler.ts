/**
 * Call Drop Handler
 * Handles dropped calls with retry logic and CRM notes
 * Features: F1263 (Call drop retry), F1264 (Call drop CRM note)
 */

import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin;

export interface CallDropConfig {
  enableRetry: boolean;
  maxRetries: number;
  retryDelayMinutes: number;
  createCRMNote: boolean;
}

export interface CallDropEvent {
  callId: string;
  contactId?: string;
  campaignId?: string;
  phoneNumber: string;
  dropReason?: string;
  timestamp: Date;
}

/**
 * Handle a dropped call - retry if configured and create CRM note
 */
export async function handleCallDrop(
  event: CallDropEvent,
  config: CallDropConfig
): Promise<{ retryScheduled: boolean; noteCreated: boolean }> {
  const results = {
    retryScheduled: false,
    noteCreated: false,
  };

  // Create CRM note if enabled
  if (config.createCRMNote && event.contactId) {
    try {
      await createDropNote(event);
      results.noteCreated = true;
    } catch (error) {
      console.error('Failed to create call drop CRM note:', error);
    }
  }

  // Schedule retry if enabled and from a campaign
  if (config.enableRetry && event.campaignId) {
    try {
      // Check retry count first
      const { data: callLog } = await supabase
        .from('call_logs')
        .select('metadata')
        .eq('id', event.callId)
        .single();

      const retryCount = callLog?.metadata?.retryCount || 0;

      if (retryCount < config.maxRetries) {
        await scheduleRetry(event, config, retryCount);
        results.retryScheduled = true;
      }
    } catch (error) {
      console.error('Failed to schedule call retry:', error);
    }
  }

  return results;
}

/**
 * Create a CRM note documenting the dropped call
 */
async function createDropNote(event: CallDropEvent): Promise<void> {
  const note = {
    contact_id: event.contactId,
    note_type: 'call_drop',
    content: `Call dropped at ${event.timestamp.toISOString()}. Reason: ${event.dropReason || 'Unknown'}`,
    metadata: {
      call_id: event.callId,
      campaign_id: event.campaignId,
      drop_reason: event.dropReason,
      phone_number: event.phoneNumber,
    },
    created_at: new Date().toISOString(),
  };

  const { error } = await supabase.from('contact_notes').insert(note);

  if (error) {
    throw new Error(`Failed to insert drop note: ${error.message}`);
  }
}

/**
 * Schedule a retry for the dropped call
 */
async function scheduleRetry(
  event: CallDropEvent,
  config: CallDropConfig,
  currentRetryCount: number
): Promise<void> {
  const retryAt = new Date();
  retryAt.setMinutes(retryAt.getMinutes() + config.retryDelayMinutes);

  // Update call log with retry info
  const { error: updateError } = await supabase
    .from('call_logs')
    .update({
      metadata: {
        retryCount: currentRetryCount + 1,
        lastRetryAt: new Date().toISOString(),
        nextRetryAt: retryAt.toISOString(),
      },
      status: 'retry_scheduled',
    })
    .eq('id', event.callId);

  if (updateError) {
    throw new Error(`Failed to update call log: ${updateError.message}`);
  }

  // Add to campaign retry queue
  if (event.campaignId) {
    const { error: queueError } = await supabase
      .from('campaign_retry_queue')
      .insert({
        campaign_id: event.campaignId,
        contact_id: event.contactId,
        phone_number: event.phoneNumber,
        retry_at: retryAt.toISOString(),
        retry_count: currentRetryCount + 1,
        original_call_id: event.callId,
        reason: event.dropReason || 'call_dropped',
        created_at: new Date().toISOString(),
      });

    if (queueError) {
      throw new Error(`Failed to queue retry: ${queueError.message}`);
    }
  }
}

/**
 * Get call drop config for a campaign
 */
export async function getCallDropConfig(campaignId: string): Promise<CallDropConfig> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('retry_config')
    .eq('id', campaignId)
    .single();

  return {
    enableRetry: campaign?.retry_config?.enableDropRetry ?? true,
    maxRetries: campaign?.retry_config?.maxDropRetries ?? 2,
    retryDelayMinutes: campaign?.retry_config?.dropRetryDelayMinutes ?? 30,
    createCRMNote: campaign?.retry_config?.createDropNote ?? true,
  };
}

/**
 * Process retry queue - called by scheduled job
 */
export async function processRetryQueue(): Promise<number> {
  const now = new Date().toISOString();

  // Get all retries that are due
  const { data: retries, error } = await supabase
    .from('campaign_retry_queue')
    .select('*')
    .lte('retry_at', now)
    .eq('status', 'pending')
    .limit(100);

  if (error || !retries) {
    console.error('Failed to fetch retry queue:', error);
    return 0;
  }

  let processed = 0;

  for (const retry of retries) {
    try {
      // Trigger new call via campaign dialer
      // This would integrate with your existing campaign dialer
      // For now, just mark as processed
      await supabase
        .from('campaign_retry_queue')
        .update({ status: 'processed', processed_at: new Date().toISOString() })
        .eq('id', retry.id);

      processed++;
    } catch (err) {
      console.error(`Failed to process retry ${retry.id}:`, err);
      await supabase
        .from('campaign_retry_queue')
        .update({ status: 'failed', error: String(err) })
        .eq('id', retry.id);
    }
  }

  return processed;
}
