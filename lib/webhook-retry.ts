/**
 * Webhook Retry Handler
 * Handles failed webhook deliveries with exponential backoff
 * Features: F1276 (Webhook delivery failure), F1277 (Webhook retry queue)
 */

import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin;

export interface WebhookDelivery {
  id?: string;
  webhookType: string;
  url: string;
  payload: Record<string, any>;
  headers?: Record<string, string>;
  retryCount?: number;
  maxRetries?: number;
  nextRetryAt?: Date;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  responseBody?: string;
  deliveryId: string;
}

const DEFAULT_MAX_RETRIES = 5;
const RETRY_DELAYS_MINUTES = [1, 5, 15, 60, 240]; // Exponential backoff

/**
 * Attempt to deliver a webhook
 */
export async function deliverWebhook(delivery: WebhookDelivery): Promise<WebhookDeliveryResult> {
  const deliveryId = delivery.id || `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    const response = await fetch(delivery.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'VoiceAIAgent/1.0',
        ...delivery.headers,
      },
      body: JSON.stringify(delivery.payload),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const responseBody = await response.text();
    const success = response.status >= 200 && response.status < 300;

    // Log delivery attempt
    await logDeliveryAttempt({
      deliveryId,
      webhookType: delivery.webhookType,
      url: delivery.url,
      statusCode: response.status,
      success,
      retryCount: delivery.retryCount || 0,
      responseBody: responseBody.substring(0, 1000), // Limit stored response
      error: success ? undefined : `HTTP ${response.status}`,
    });

    if (!success) {
      // Queue for retry if not successful
      await queueForRetry(delivery, deliveryId, response.status, responseBody);
    }

    return {
      success,
      statusCode: response.status,
      responseBody,
      deliveryId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log failure
    await logDeliveryAttempt({
      deliveryId,
      webhookType: delivery.webhookType,
      url: delivery.url,
      success: false,
      retryCount: delivery.retryCount || 0,
      error: errorMessage,
    });

    // Queue for retry
    await queueForRetry(delivery, deliveryId, undefined, errorMessage);

    return {
      success: false,
      error: errorMessage,
      deliveryId,
    };
  }
}

/**
 * Log a webhook delivery attempt
 */
async function logDeliveryAttempt(log: {
  deliveryId: string;
  webhookType: string;
  url: string;
  statusCode?: number;
  success: boolean;
  retryCount: number;
  responseBody?: string;
  error?: string;
}): Promise<void> {
  const { error } = await supabase.from('webhook_delivery_log').insert({
    delivery_id: log.deliveryId,
    webhook_type: log.webhookType,
    url: log.url,
    status_code: log.statusCode,
    success: log.success,
    retry_count: log.retryCount,
    response_body: log.responseBody,
    error_message: log.error,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to log webhook delivery:', error);
  }
}

/**
 * Queue a failed webhook for retry
 */
async function queueForRetry(
  delivery: WebhookDelivery,
  deliveryId: string,
  statusCode: number | undefined,
  errorMessage: string
): Promise<void> {
  const retryCount = (delivery.retryCount || 0) + 1;
  const maxRetries = delivery.maxRetries || DEFAULT_MAX_RETRIES;

  if (retryCount > maxRetries) {
    console.error(`Webhook ${deliveryId} exceeded max retries (${maxRetries})`);
    await markDeliveryFailed(deliveryId, 'Max retries exceeded');
    return;
  }

  // Calculate next retry time using exponential backoff
  const delayMinutes = RETRY_DELAYS_MINUTES[Math.min(retryCount - 1, RETRY_DELAYS_MINUTES.length - 1)];
  const nextRetryAt = new Date();
  nextRetryAt.setMinutes(nextRetryAt.getMinutes() + delayMinutes);

  // Insert or update retry queue entry
  const { error } = await supabase.from('webhook_retry_queue').upsert({
    delivery_id: deliveryId,
    webhook_type: delivery.webhookType,
    url: delivery.url,
    payload: delivery.payload,
    headers: delivery.headers || {},
    retry_count: retryCount,
    max_retries: maxRetries,
    next_retry_at: nextRetryAt.toISOString(),
    last_status_code: statusCode,
    last_error: errorMessage.substring(0, 500),
    status: 'pending',
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to queue webhook for retry:', error);
  }
}

/**
 * Mark a delivery as permanently failed
 */
async function markDeliveryFailed(deliveryId: string, reason: string): Promise<void> {
  await supabase
    .from('webhook_retry_queue')
    .update({
      status: 'failed',
      failure_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('delivery_id', deliveryId);
}

/**
 * Process webhook retry queue - called by scheduled job
 */
export async function processWebhookRetryQueue(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const now = new Date().toISOString();

  // Get all webhooks that are due for retry
  const { data: retries, error } = await supabase
    .from('webhook_retry_queue')
    .select('*')
    .lte('next_retry_at', now)
    .eq('status', 'pending')
    .limit(50); // Process in batches

  if (error || !retries) {
    console.error('Failed to fetch webhook retry queue:', error);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;

  for (const retry of retries) {
    const delivery: WebhookDelivery = {
      id: retry.delivery_id,
      webhookType: retry.webhook_type,
      url: retry.url,
      payload: retry.payload,
      headers: retry.headers,
      retryCount: retry.retry_count,
      maxRetries: retry.max_retries,
    };

    const result = await deliverWebhook(delivery);

    if (result.success) {
      // Remove from retry queue
      await supabase
        .from('webhook_retry_queue')
        .update({
          status: 'delivered',
          updated_at: new Date().toISOString(),
        })
        .eq('delivery_id', retry.delivery_id);
      succeeded++;
    } else {
      failed++;
      // Will be re-queued by deliverWebhook if retries remain
    }
  }

  return {
    processed: retries.length,
    succeeded,
    failed,
  };
}

/**
 * Get webhook delivery stats for monitoring
 */
export async function getWebhookStats(timeframeHours: number = 24): Promise<{
  totalAttempts: number;
  successRate: number;
  pendingRetries: number;
  failedPermanently: number;
}> {
  const since = new Date();
  since.setHours(since.getHours() - timeframeHours);

  const [attempts, retries] = await Promise.all([
    supabase
      .from('webhook_delivery_log')
      .select('success', { count: 'exact' })
      .gte('created_at', since.toISOString()),

    supabase
      .from('webhook_retry_queue')
      .select('status', { count: 'exact' })
      .gte('updated_at', since.toISOString()),
  ]);

  const totalAttempts = attempts.count || 0;
  const succeeded = attempts.data?.filter((a) => a.success).length || 0;
  const successRate = totalAttempts > 0 ? (succeeded / totalAttempts) * 100 : 100;

  const pendingRetries = retries.data?.filter((r) => r.status === 'pending').length || 0;
  const failedPermanently = retries.data?.filter((r) => r.status === 'failed').length || 0;

  return {
    totalAttempts,
    successRate,
    pendingRetries,
    failedPermanently,
  };
}
