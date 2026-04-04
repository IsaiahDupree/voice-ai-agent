/**
 * F0141: Inbound webhook trigger
 * Background job that triggers configured webhooks for call events
 */

import { supabaseAdmin } from './supabase';
import { triggerWebhook, WebhookPayload } from './webhooks';

export async function triggerCallStartedWebhooks(callData: {
  call_id: string;
  from_number: string;
  to_number: string;
  direction: string;
  started_at: string;
  [key: string]: any;
}): Promise<void> {
  try {
    // Get all enabled webhooks for call.started event
    const { data: webhooks } = await supabaseAdmin
      .from('webhook_configs')
      .select('*')
      .eq('event_type', 'call.started')
      .eq('enabled', true);

    if (!webhooks || webhooks.length === 0) {
      return; // No webhooks configured
    }

    const payload: WebhookPayload = {
      event: 'call.started',
      call_id: callData.call_id,
      timestamp: new Date().toISOString(),
      data: {
        from_number: callData.from_number,
        to_number: callData.to_number,
        direction: callData.direction,
        started_at: callData.started_at,
        assistant_id: callData.assistant_id,
        contact_id: callData.contact_id,
      },
    };

    // Trigger all webhooks in parallel
    const results = await Promise.allSettled(
      webhooks.map((webhook) =>
        triggerWebhook(
          {
            url: webhook.url,
            secret: webhook.secret,
            headers: webhook.headers || {},
            retries: 3,
          },
          payload
        )
      )
    );

    // Log results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const webhook = webhooks[i];

      await supabaseAdmin.from('webhook_logs').insert({
        webhook_id: webhook.id,
        event_type: 'call.started',
        call_id: callData.call_id,
        success: result.status === 'fulfilled' && result.value.success,
        status_code:
          result.status === 'fulfilled' ? result.value.statusCode : null,
        error: result.status === 'rejected' ? result.reason : result.value?.error,
        attempts: result.status === 'fulfilled' ? result.value.attempts : 0,
        triggered_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error triggering call.started webhooks:', error);
  }
}

export async function triggerCallEndedWebhooks(callData: {
  call_id: string;
  from_number: string;
  to_number: string;
  direction: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  end_reason: string;
  [key: string]: any;
}): Promise<void> {
  try {
    const { data: webhooks } = await supabaseAdmin
      .from('webhook_configs')
      .select('*')
      .eq('event_type', 'call.ended')
      .eq('enabled', true);

    if (!webhooks || webhooks.length === 0) {
      return;
    }

    const payload: WebhookPayload = {
      event: 'call.ended',
      call_id: callData.call_id,
      timestamp: new Date().toISOString(),
      data: {
        from_number: callData.from_number,
        to_number: callData.to_number,
        direction: callData.direction,
        started_at: callData.started_at,
        ended_at: callData.ended_at,
        duration_seconds: callData.duration_seconds,
        end_reason: callData.end_reason,
        outcome: callData.outcome,
        cost_usd: callData.cost_usd,
      },
    };

    const results = await Promise.allSettled(
      webhooks.map((webhook) =>
        triggerWebhook(
          {
            url: webhook.url,
            secret: webhook.secret,
            headers: webhook.headers || {},
            retries: 3,
          },
          payload
        )
      )
    );

    // Log results
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const webhook = webhooks[i];

      await supabaseAdmin.from('webhook_logs').insert({
        webhook_id: webhook.id,
        event_type: 'call.ended',
        call_id: callData.call_id,
        success: result.status === 'fulfilled' && result.value.success,
        status_code:
          result.status === 'fulfilled' ? result.value.statusCode : null,
        error: result.status === 'rejected' ? result.reason : result.value?.error,
        attempts: result.status === 'fulfilled' ? result.value.attempts : 0,
        triggered_at: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error triggering call.ended webhooks:', error);
  }
}
