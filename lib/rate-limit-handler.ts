/**
 * Rate Limit Handler
 * Handles 429 rate limits from external APIs with exponential backoff
 * Features: F1303 (Cal.com), F1304 (ElevenLabs), F1305 (Vapi)
 */

import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin;

export type APIProvider = 'calcom' | 'elevenlabs' | 'vapi' | 'twilio' | 'deepgram';

export interface RateLimitConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface RequestOptions {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 60000,
  backoffMultiplier: 2,
};

// Provider-specific configs
const PROVIDER_CONFIGS: Record<APIProvider, Partial<RateLimitConfig>> = {
  calcom: {
    maxRetries: 3,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
  },
  elevenlabs: {
    maxRetries: 5,
    initialDelayMs: 1000,
    maxDelayMs: 60000,
  },
  vapi: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
  },
  twilio: {
    maxRetries: 3,
    initialDelayMs: 2000,
  },
  deepgram: {
    maxRetries: 3,
    initialDelayMs: 1000,
  },
};

/**
 * Execute request with automatic rate limit retry
 */
export async function executeWithRateLimitRetry<T>(
  provider: APIProvider,
  options: RequestOptions,
  customConfig?: Partial<RateLimitConfig>
): Promise<{ success: boolean; data?: T; error?: string; retries: number }> {
  const config = {
    ...DEFAULT_CONFIG,
    ...PROVIDER_CONFIGS[provider],
    ...customConfig,
  };

  let lastError: string = '';
  let retries = 0;

  while (retries <= config.maxRetries) {
    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: AbortSignal.timeout(options.timeout || 30000),
      });

      // Success
      if (response.ok) {
        const data = await response.json();
        if (retries > 0) {
          await logRateLimitRecovery(provider, retries);
        }
        return { success: true, data, retries };
      }

      // Rate limit - retry with backoff
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = calculateBackoffDelay(retries, config, retryAfter);

        console.warn(
          `Rate limit hit for ${provider}, retry ${retries + 1}/${config.maxRetries} in ${delayMs}ms`
        );

        await logRateLimitHit(provider, retries, delayMs);

        if (retries < config.maxRetries) {
          await sleep(delayMs);
          retries++;
          continue;
        } else {
          lastError = `Rate limit exceeded after ${config.maxRetries} retries`;
          break;
        }
      }

      // Other error
      const errorText = await response.text();
      lastError = `HTTP ${response.status}: ${errorText}`;
      break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      break;
    }
  }

  return { success: false, error: lastError, retries };
}

/**
 * Calculate backoff delay
 */
function calculateBackoffDelay(
  retryCount: number,
  config: RateLimitConfig,
  retryAfterHeader?: string | null
): number {
  // Use Retry-After header if provided
  if (retryAfterHeader) {
    const retryAfter = parseInt(retryAfterHeader, 10);
    if (!isNaN(retryAfter)) {
      return Math.min(retryAfter * 1000, config.maxDelayMs);
    }
  }

  // Exponential backoff
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, retryCount);

  // Add jitter (±20%)
  const jitter = delay * 0.2 * (Math.random() - 0.5);

  return Math.min(delay + jitter, config.maxDelayMs);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Log rate limit hit
 */
async function logRateLimitHit(
  provider: APIProvider,
  retryCount: number,
  delayMs: number
): Promise<void> {
  await supabase.from('rate_limit_log').insert({
    provider,
    retry_count: retryCount,
    delay_ms: delayMs,
    occurred_at: new Date().toISOString(),
  });
}

/**
 * Log successful recovery from rate limit
 */
async function logRateLimitRecovery(provider: APIProvider, totalRetries: number): Promise<void> {
  await supabase.from('rate_limit_recoveries').insert({
    provider,
    total_retries: totalRetries,
    recovered_at: new Date().toISOString(),
  });
}

/**
 * Cal.com specific helper
 */
export async function callCalComWithRetry<T>(
  endpoint: string,
  options: Omit<RequestOptions, 'url'>
): Promise<{ success: boolean; data?: T; error?: string }> {
  const result = await executeWithRateLimitRetry<T>('calcom', {
    url: `https://api.cal.com/v1${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.CALCOM_API_KEY}`,
      ...options.headers,
    },
    ...options,
  });

  return {
    success: result.success,
    data: result.data,
    error: result.error,
  };
}

/**
 * ElevenLabs specific helper
 */
export async function callElevenLabsWithRetry<T>(
  endpoint: string,
  options: Omit<RequestOptions, 'url'>
): Promise<{ success: boolean; data?: T; error?: string }> {
  const result = await executeWithRateLimitRetry<T>('elevenlabs', {
    url: `https://api.elevenlabs.io/v1${endpoint}`,
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      ...options.headers,
    },
    ...options,
  });

  return {
    success: result.success,
    data: result.data,
    error: result.error,
  };
}

/**
 * Vapi specific helper
 */
export async function callVapiWithRetry<T>(
  endpoint: string,
  options: Omit<RequestOptions, 'url'>
): Promise<{ success: boolean; data?: T; error?: string }> {
  const result = await executeWithRateLimitRetry<T>('vapi', {
    url: `https://api.vapi.ai${endpoint}`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      ...options.headers,
    },
    ...options,
  });

  return {
    success: result.success,
    data: result.data,
    error: result.error,
  };
}

/**
 * Get rate limit stats for monitoring
 */
export async function getRateLimitStats(hours: number = 24): Promise<{
  totalHits: number;
  byProvider: Record<string, number>;
  recoveries: number;
  avgRetriesPerRecovery: number;
}> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const [hits, recoveries] = await Promise.all([
    supabase
      .from('rate_limit_log')
      .select('provider, retry_count')
      .gte('occurred_at', since.toISOString()),

    supabase
      .from('rate_limit_recoveries')
      .select('total_retries')
      .gte('recovered_at', since.toISOString()),
  ]);

  const hitData = hits.data || [];
  const recoveryData = recoveries.data || [];

  const byProvider: Record<string, number> = {};
  hitData.forEach((hit) => {
    byProvider[hit.provider] = (byProvider[hit.provider] || 0) + 1;
  });

  const totalRetries = recoveryData.reduce((sum, r) => sum + r.total_retries, 0);
  const avgRetries = recoveryData.length > 0 ? totalRetries / recoveryData.length : 0;

  return {
    totalHits: hitData.length,
    byProvider,
    recoveries: recoveryData.length,
    avgRetriesPerRecovery: avgRetries,
  };
}

/**
 * Check if a provider is currently rate limited
 */
export async function isProviderRateLimited(provider: APIProvider): Promise<boolean> {
  const lastMinute = new Date();
  lastMinute.setMinutes(lastMinute.getMinutes() - 1);

  const { count } = await supabase
    .from('rate_limit_log')
    .select('id')
    .eq('provider', provider)
    .gte('occurred_at', lastMinute.toISOString());

  // If we hit rate limit more than 3 times in the last minute, consider it rate limited
  return (count || 0) >= 3;
}
