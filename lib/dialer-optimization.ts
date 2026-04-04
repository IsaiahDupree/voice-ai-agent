// F0256: Dialer warm-up - start slow and ramp up concurrency
// F0257: Predictive dial ratio - configure dial-to-agent ratio

import { supabase } from './supabase'

export interface DialerWarmupConfig {
  campaign_id: string
  initial_concurrency: number // Start with this many simultaneous calls
  max_concurrency: number // Ramp up to this limit
  ramp_duration_minutes: number // Time to reach max (e.g., 30 minutes)
  step_size: number // Increase by this many calls per step
  step_interval_minutes: number // How often to increase (e.g., every 5 min)
}

export interface PredictiveDialConfig {
  campaign_id: string
  dial_ratio: number // Calls to dial per available agent (e.g., 2.5 = dial 2.5x agents)
  max_abandon_rate: number // Max acceptable abandon rate % (e.g., 3%)
  auto_adjust: boolean // Automatically adjust ratio based on performance
}

export interface DialerState {
  campaign_id: string
  current_concurrency: number
  warmup_started_at?: string
  warmup_config?: DialerWarmupConfig
  predictive_config?: PredictiveDialConfig
  stats: {
    total_calls: number
    abandoned_calls: number
    abandon_rate: number
  }
}

/**
 * F0256: Initialize dialer warm-up for campaign
 *
 * @param config Warm-up configuration
 */
export async function initializeDialerWarmup(
  config: DialerWarmupConfig
): Promise<DialerState> {
  // Validation
  if (config.initial_concurrency < 1) {
    throw new Error('Initial concurrency must be at least 1')
  }

  if (config.max_concurrency <= config.initial_concurrency) {
    throw new Error('Max concurrency must be greater than initial concurrency')
  }

  if (config.ramp_duration_minutes < 1) {
    throw new Error('Ramp duration must be at least 1 minute')
  }

  const state: DialerState = {
    campaign_id: config.campaign_id,
    current_concurrency: config.initial_concurrency,
    warmup_started_at: new Date().toISOString(),
    warmup_config: config,
    stats: {
      total_calls: 0,
      abandoned_calls: 0,
      abandon_rate: 0,
    },
  }

  // Store state in database
  await supabase.from('dialer_state').upsert({
    campaign_id: config.campaign_id,
    current_concurrency: state.current_concurrency,
    warmup_started_at: state.warmup_started_at,
    warmup_config: config,
    updated_at: new Date().toISOString(),
  })

  console.log(
    `✓ Dialer warm-up initialized for campaign ${config.campaign_id}`,
    `Starting at ${config.initial_concurrency}, ramping to ${config.max_concurrency} over ${config.ramp_duration_minutes} minutes`
  )

  return state
}

/**
 * F0256: Update dialer concurrency based on warm-up schedule
 *
 * Call this periodically (e.g., every minute) to check if concurrency should increase
 *
 * @param campaignId Campaign ID
 * @returns Updated dialer state
 */
export async function updateDialerWarmup(
  campaignId: string
): Promise<DialerState> {
  const { data: state, error } = await supabase
    .from('dialer_state')
    .select('*')
    .eq('campaign_id', campaignId)
    .single()

  if (error || !state) {
    throw new Error('Dialer state not found for campaign')
  }

  const config = state.warmup_config as DialerWarmupConfig | null

  if (!config || !state.warmup_started_at) {
    // No warm-up configured, return current state
    return state as DialerState
  }

  const startedAt = new Date(state.warmup_started_at)
  const now = new Date()
  const elapsedMinutes = (now.getTime() - startedAt.getTime()) / 1000 / 60

  // Check if warm-up is complete
  if (elapsedMinutes >= config.ramp_duration_minutes) {
    // Warm-up complete, set to max concurrency
    if (state.current_concurrency < config.max_concurrency) {
      await supabase
        .from('dialer_state')
        .update({
          current_concurrency: config.max_concurrency,
          updated_at: now.toISOString(),
        })
        .eq('campaign_id', campaignId)

      console.log(
        `✓ Dialer warm-up complete for campaign ${campaignId}. Now at max concurrency: ${config.max_concurrency}`
      )

      return {
        ...state,
        current_concurrency: config.max_concurrency,
      } as DialerState
    }

    return state as DialerState
  }

  // Calculate how many steps have passed
  const stepsPassed = Math.floor(elapsedMinutes / config.step_interval_minutes)
  const newConcurrency = Math.min(
    config.initial_concurrency + stepsPassed * config.step_size,
    config.max_concurrency
  )

  // Update if concurrency has increased
  if (newConcurrency > state.current_concurrency) {
    await supabase
      .from('dialer_state')
      .update({
        current_concurrency: newConcurrency,
        updated_at: now.toISOString(),
      })
      .eq('campaign_id', campaignId)

    console.log(
      `✓ Dialer warm-up step for campaign ${campaignId}: ${state.current_concurrency} → ${newConcurrency}`
    )

    return {
      ...state,
      current_concurrency: newConcurrency,
    } as DialerState
  }

  return state as DialerState
}

/**
 * F0257: Configure predictive dialing ratio
 *
 * @param config Predictive dial configuration
 */
export async function configurePredictiveDialing(
  config: PredictiveDialConfig
): Promise<void> {
  if (config.dial_ratio < 1) {
    throw new Error('Dial ratio must be at least 1.0')
  }

  if (config.dial_ratio > 5) {
    throw new Error('Dial ratio cannot exceed 5.0 (safety limit)')
  }

  if (config.max_abandon_rate < 0 || config.max_abandon_rate > 10) {
    throw new Error('Max abandon rate must be between 0 and 10%')
  }

  await supabase.from('dialer_state').upsert({
    campaign_id: config.campaign_id,
    predictive_config: config,
    updated_at: new Date().toISOString(),
  })

  console.log(
    `✓ Predictive dialing configured for campaign ${config.campaign_id}`,
    `Dial ratio: ${config.dial_ratio}, Max abandon: ${config.max_abandon_rate}%`
  )
}

/**
 * F0257: Calculate how many calls to dial based on available agents
 *
 * @param campaignId Campaign ID
 * @param availableAgents Number of agents ready to take calls
 * @returns Number of calls to dial
 */
export async function calculateDialCount(
  campaignId: string,
  availableAgents: number
): Promise<number> {
  const { data: state } = await supabase
    .from('dialer_state')
    .select('*')
    .eq('campaign_id', campaignId)
    .single()

  if (!state?.predictive_config) {
    // No predictive config, dial 1:1
    return availableAgents
  }

  const config = state.predictive_config as PredictiveDialConfig

  // Calculate base dial count
  let dialCount = Math.floor(availableAgents * config.dial_ratio)

  // If auto-adjust enabled, reduce ratio if abandon rate is too high
  if (config.auto_adjust && state.stats) {
    const stats = state.stats as DialerState['stats']
    if (stats.abandon_rate > config.max_abandon_rate) {
      // Reduce dial ratio by 10%
      const adjustedRatio = config.dial_ratio * 0.9
      dialCount = Math.floor(availableAgents * adjustedRatio)

      console.log(
        `⚠️ Abandon rate (${stats.abandon_rate}%) exceeds max (${config.max_abandon_rate}%). Reducing dial ratio to ${adjustedRatio}`
      )

      // Update config with new ratio
      await supabase
        .from('dialer_state')
        .update({
          predictive_config: { ...config, dial_ratio: adjustedRatio },
          updated_at: new Date().toISOString(),
        })
        .eq('campaign_id', campaignId)
    }
  }

  // Respect concurrency limits from warm-up
  if (state.current_concurrency) {
    dialCount = Math.min(dialCount, state.current_concurrency)
  }

  return Math.max(1, dialCount) // At least 1 call
}

/**
 * Update dialer statistics
 *
 * Call this after each call completes to track abandon rate
 */
export async function updateDialerStats(
  campaignId: string,
  callAbandoned: boolean
): Promise<void> {
  const { data: state } = await supabase
    .from('dialer_state')
    .select('stats')
    .eq('campaign_id', campaignId)
    .single()

  const stats = (state?.stats as DialerState['stats']) || {
    total_calls: 0,
    abandoned_calls: 0,
    abandon_rate: 0,
  }

  stats.total_calls++
  if (callAbandoned) {
    stats.abandoned_calls++
  }

  stats.abandon_rate =
    stats.total_calls > 0
      ? (stats.abandoned_calls / stats.total_calls) * 100
      : 0

  await supabase
    .from('dialer_state')
    .update({
      stats,
      updated_at: new Date().toISOString(),
    })
    .eq('campaign_id', campaignId)
}

/**
 * Get current dialer state
 */
export async function getDialerState(
  campaignId: string
): Promise<DialerState | null> {
  const { data, error } = await supabase
    .from('dialer_state')
    .select('*')
    .eq('campaign_id', campaignId)
    .single()

  if (error || !data) {
    return null
  }

  return data as DialerState
}

/**
 * Reset dialer warm-up (start over)
 */
export async function resetDialerWarmup(campaignId: string): Promise<void> {
  const { data: state } = await supabase
    .from('dialer_state')
    .select('warmup_config')
    .eq('campaign_id', campaignId)
    .single()

  if (state?.warmup_config) {
    const config = state.warmup_config as DialerWarmupConfig

    await supabase
      .from('dialer_state')
      .update({
        current_concurrency: config.initial_concurrency,
        warmup_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('campaign_id', campaignId)

    console.log(`✓ Reset dialer warm-up for campaign ${campaignId}`)
  }
}
