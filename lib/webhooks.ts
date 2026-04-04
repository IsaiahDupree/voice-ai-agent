/**
 * F0141: Inbound webhook trigger
 * Utility functions for triggering external webhooks
 */

export interface WebhookPayload {
  event: string;
  call_id: string;
  timestamp: string;
  data: Record<string, any>;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  headers?: Record<string, string>;
  retries?: number;
}

/**
 * Triggers an external webhook with retry logic
 */
export async function triggerWebhook(
  config: WebhookConfig,
  payload: WebhookPayload
): Promise<{
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
}> {
  const maxRetries = config.retries || 3;
  let attempts = 0;
  let lastError: string | undefined;

  while (attempts < maxRetries) {
    attempts++;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Voice-AI-Agent/1.0',
        ...config.headers,
      };

      // Add HMAC signature if secret provided
      if (config.secret) {
        const signature = await createWebhookSignature(payload, config.secret);
        headers['X-Webhook-Signature'] = signature;
      }

      const response = await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (response.ok) {
        return {
          success: true,
          statusCode: response.status,
          attempts,
        };
      }

      lastError = `HTTP ${response.status}: ${response.statusText}`;

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        break;
      }

      // Wait before retry (exponential backoff)
      if (attempts < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    } catch (error: any) {
      lastError = error.message;

      // Wait before retry
      if (attempts < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts) * 1000));
      }
    }
  }

  return {
    success: false,
    error: lastError || 'Unknown error',
    attempts,
  };
}

/**
 * Creates HMAC SHA-256 signature for webhook payload
 */
async function createWebhookSignature(
  payload: WebhookPayload,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const keyData = encoder.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies webhook signature
 */
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const keyData = encoder.encode(secret);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signatureBytes = new Uint8Array(
    signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  return await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, data);
}
