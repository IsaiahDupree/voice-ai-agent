/**
 * Graceful Shutdown Handler
 * Ensures clean shutdown of campaigns and active calls
 * Feature: F1292 (Graceful shutdown)
 */

import { supabaseAdmin } from '@/lib/supabase';

const supabase = supabaseAdmin;

export interface ShutdownStatus {
  initiated: boolean;
  activeCalls: number;
  activeCampaigns: number;
  pendingTasks: number;
  readyToShutdown: boolean;
}

let isShuttingDown = false;
let shutdownCallbacks: Array<() => Promise<void>> = [];

/**
 * Initialize graceful shutdown handlers
 */
export function initializeGracefulShutdown(): void {
  // Handle SIGTERM (Docker, Kubernetes, systemd)
  process.on('SIGTERM', handleShutdownSignal);

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', handleShutdownSignal);

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    handleShutdownSignal();
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    handleShutdownSignal();
  });

  console.log('Graceful shutdown handlers initialized');
}

/**
 * Register a cleanup callback to run during shutdown
 */
export function registerShutdownCallback(callback: () => Promise<void>): void {
  shutdownCallbacks.push(callback);
}

/**
 * Handle shutdown signal
 */
async function handleShutdownSignal(): Promise<void> {
  if (isShuttingDown) {
    console.log('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  console.log('Shutdown signal received, initiating graceful shutdown...');

  try {
    // 1. Stop accepting new requests
    console.log('Step 1: Stopping new request acceptance');
    await stopAcceptingNewRequests();

    // 2. Pause all running campaigns
    console.log('Step 2: Pausing active campaigns');
    await pauseActiveCampaigns();

    // 3. Wait for active calls to complete (with timeout)
    console.log('Step 3: Waiting for active calls to complete');
    await waitForActiveCalls(30000); // 30 second timeout

    // 4. Process pending webhooks
    console.log('Step 4: Processing pending webhooks');
    await processPendingWebhooks();

    // 5. Run registered cleanup callbacks
    console.log('Step 5: Running cleanup callbacks');
    await runCleanupCallbacks();

    // 6. Close database connections
    console.log('Step 6: Closing database connections');
    await closeDatabaseConnections();

    // 7. Log shutdown completion
    console.log('Graceful shutdown completed successfully');
    await logShutdown('success');

    process.exit(0);
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    await logShutdown('error', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Stop accepting new requests
 */
async function stopAcceptingNewRequests(): Promise<void> {
  // Set global flag that can be checked in middleware
  global.__SHUTDOWN_MODE__ = true;

  // Update status in database
  await supabase.from('system_status').upsert({
    key: 'shutdown_mode',
    value: true,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Pause all active campaigns
 */
async function pauseActiveCampaigns(): Promise<void> {
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, name')
    .in('status', ['running', 'dialing']);

  if (!campaigns || campaigns.length === 0) {
    console.log('No active campaigns to pause');
    return;
  }

  console.log(`Pausing ${campaigns.length} active campaigns`);

  const { error } = await supabase
    .from('campaigns')
    .update({
      status: 'paused',
      metadata: supabase.rpc('jsonb_set', {
        target: 'metadata',
        path: ['shutdown_pause'],
        value: 'true',
      }),
      updated_at: new Date().toISOString(),
    })
    .in('status', ['running', 'dialing']);

  if (error) {
    console.error('Failed to pause campaigns:', error);
  }
}

/**
 * Wait for active calls to complete
 */
async function waitForActiveCalls(timeoutMs: number): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const { count } = await supabase
      .from('call_logs')
      .select('id')
      .in('status', ['ringing', 'in_progress', 'connecting']);

    if (!count || count === 0) {
      console.log('All active calls completed');
      return;
    }

    console.log(`Waiting for ${count} active calls to complete...`);
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Check every 2 seconds
  }

  // Timeout reached, force disconnect remaining calls
  console.warn('Timeout reached, force disconnecting remaining calls');
  await forceDisconnectCalls();
}

/**
 * Force disconnect remaining active calls
 */
async function forceDisconnectCalls(): Promise<void> {
  const { data: activeCalls } = await supabase
    .from('call_logs')
    .select('id, vapi_call_id')
    .in('status', ['ringing', 'in_progress', 'connecting']);

  if (!activeCalls || activeCalls.length === 0) {
    return;
  }

  console.log(`Force disconnecting ${activeCalls.length} calls`);

  for (const call of activeCalls) {
    try {
      // Attempt to end call via Vapi API
      if (call.vapi_call_id) {
        await fetch(`https://api.vapi.ai/call/${call.vapi_call_id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
          },
        });
      }

      // Update call status in database
      await supabase
        .from('call_logs')
        .update({
          status: 'ended',
          end_reason: 'shutdown',
          ended_at: new Date().toISOString(),
        })
        .eq('id', call.id);
    } catch (error) {
      console.error(`Failed to disconnect call ${call.id}:`, error);
    }
  }
}

/**
 * Process pending webhooks
 */
async function processPendingWebhooks(): Promise<void> {
  const { count } = await supabase
    .from('webhook_retry_queue')
    .select('id')
    .eq('status', 'pending')
    .limit(1);

  if (!count || count === 0) {
    console.log('No pending webhooks to process');
    return;
  }

  console.log(`Processing ${count} pending webhooks before shutdown`);

  // Give webhooks 10 seconds to process
  await new Promise((resolve) => setTimeout(resolve, 10000));
}

/**
 * Run registered cleanup callbacks
 */
async function runCleanupCallbacks(): Promise<void> {
  console.log(`Running ${shutdownCallbacks.length} cleanup callbacks`);

  for (const callback of shutdownCallbacks) {
    try {
      await callback();
    } catch (error) {
      console.error('Error in cleanup callback:', error);
    }
  }
}

/**
 * Close database connections
 */
async function closeDatabaseConnections(): Promise<void> {
  // Supabase client doesn't require explicit connection closing
  // But we can clear any cached connections
  console.log('Database connections closed');
}

/**
 * Log shutdown event
 */
async function logShutdown(status: 'success' | 'error', errorMessage?: string): Promise<void> {
  try {
    await supabase.from('shutdown_log').insert({
      status,
      error_message: errorMessage,
      shutdown_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log shutdown:', error);
  }
}

/**
 * Get current shutdown status
 */
export async function getShutdownStatus(): Promise<ShutdownStatus> {
  const [activeCalls, activeCampaigns, pendingWebhooks] = await Promise.all([
    supabase
      .from('call_logs')
      .select('id')
      .in('status', ['ringing', 'in_progress', 'connecting']),

    supabase
      .from('campaigns')
      .select('id')
      .in('status', ['running', 'dialing']),

    supabase
      .from('webhook_retry_queue')
      .select('id')
      .eq('status', 'pending'),
  ]);

  const activeCallCount = activeCalls.count || 0;
  const activeCampaignCount = activeCampaigns.count || 0;
  const pendingTaskCount = pendingWebhooks.count || 0;

  return {
    initiated: isShuttingDown,
    activeCalls: activeCallCount,
    activeCampaigns: activeCampaignCount,
    pendingTasks: pendingTaskCount,
    readyToShutdown: activeCallCount === 0 && activeCampaignCount === 0 && pendingTaskCount === 0,
  };
}

/**
 * Check if in shutdown mode
 */
export function isInShutdownMode(): boolean {
  return isShuttingDown || global.__SHUTDOWN_MODE__ === true;
}

// Export for middleware
declare global {
  var __SHUTDOWN_MODE__: boolean | undefined;
}
