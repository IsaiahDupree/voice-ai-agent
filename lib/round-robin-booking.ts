// F0292: Round-robin booking - distribute bookings across multiple hosts

import { calcomClient, type BookingParams, type CalComBooking } from './calcom'
import { supabase } from './supabase'

export interface RoundRobinHost {
  eventTypeId: number
  hostName: string
  hostEmail: string
  weight?: number // Optional: for weighted distribution (default 1)
  maxBookingsPerDay?: number // Optional: max daily bookings per host
}

export interface RoundRobinConfig {
  hosts: RoundRobinHost[]
  strategy: 'sequential' | 'weighted' | 'least-busy'
}

/**
 * Track round-robin booking count in database
 */
async function getHostBookingCount(hostEmail: string, dateStr: string): Promise<number> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact' })
    .eq('host_email', hostEmail)
    .gte('start_time', `${dateStr}T00:00:00Z`)
    .lte('start_time', `${dateStr}T23:59:59Z`)

  if (error) {
    console.error('Error getting host booking count:', error)
    return 0
  }

  return data?.length || 0
}

/**
 * Get next available host index from database
 */
async function getRoundRobinIndex(configId: string): Promise<number> {
  const { data, error } = await supabase
    .from('round_robin_state')
    .select('current_index')
    .eq('config_id', configId)
    .single()

  if (error || !data) {
    // Initialize if not exists
    await supabase
      .from('round_robin_state')
      .insert({ config_id: configId, current_index: 0 })
    return 0
  }

  return data.current_index
}

/**
 * Increment round-robin index
 */
async function incrementRoundRobinIndex(
  configId: string,
  hostsCount: number
): Promise<void> {
  const currentIndex = await getRoundRobinIndex(configId)
  const nextIndex = (currentIndex + 1) % hostsCount

  await supabase
    .from('round_robin_state')
    .update({ current_index: nextIndex })
    .eq('config_id', configId)
}

/**
 * F0292: Select next host using round-robin strategy
 */
async function selectHostSequential(
  config: RoundRobinConfig,
  configId: string
): Promise<RoundRobinHost> {
  const index = await getRoundRobinIndex(configId)
  const host = config.hosts[index]

  // Increment for next booking
  await incrementRoundRobinIndex(configId, config.hosts.length)

  return host
}

/**
 * Select host using weighted distribution
 * Hosts with higher weight get more bookings
 */
async function selectHostWeighted(
  config: RoundRobinConfig
): Promise<RoundRobinHost> {
  const totalWeight = config.hosts.reduce((sum, host) => sum + (host.weight || 1), 0)
  let random = Math.random() * totalWeight

  for (const host of config.hosts) {
    const weight = host.weight || 1
    random -= weight
    if (random <= 0) {
      return host
    }
  }

  // Fallback to first host
  return config.hosts[0]
}

/**
 * Select host with least bookings today
 */
async function selectHostLeastBusy(
  config: RoundRobinConfig,
  dateStr: string
): Promise<RoundRobinHost> {
  const hostCounts = await Promise.all(
    config.hosts.map(async (host) => ({
      host,
      count: await getHostBookingCount(host.hostEmail, dateStr),
    }))
  )

  // Filter out hosts that have reached their daily max
  const availableHosts = hostCounts.filter(
    ({ host, count }) =>
      !host.maxBookingsPerDay || count < host.maxBookingsPerDay
  )

  if (availableHosts.length === 0) {
    throw new Error('All hosts have reached their daily booking limit')
  }

  // Sort by count ascending and return host with least bookings
  availableHosts.sort((a, b) => a.count - b.count)
  return availableHosts[0].host
}

/**
 * F0292: Create round-robin booking
 *
 * Automatically selects the next available host based on configured strategy
 * and creates booking with their event type.
 *
 * @param config Round-robin configuration with hosts and strategy
 * @param bookingParams Booking parameters (eventTypeId will be overridden)
 * @param configId Unique identifier for this round-robin config (for state tracking)
 * @returns Booking with selected host
 */
export async function createRoundRobinBooking(
  config: RoundRobinConfig,
  bookingParams: Omit<BookingParams, 'eventTypeId'>,
  configId: string = 'default'
): Promise<{
  booking: CalComBooking
  selectedHost: RoundRobinHost
}> {
  if (!config.hosts || config.hosts.length === 0) {
    throw new Error('Round-robin config must have at least one host')
  }

  // Select host based on strategy
  let selectedHost: RoundRobinHost
  const dateStr = bookingParams.start.split('T')[0]

  switch (config.strategy) {
    case 'sequential':
      selectedHost = await selectHostSequential(config, configId)
      break
    case 'weighted':
      selectedHost = await selectHostWeighted(config)
      break
    case 'least-busy':
      selectedHost = await selectHostLeastBusy(config, dateStr)
      break
    default:
      selectedHost = config.hosts[0]
  }

  console.log(
    `Round-robin selected host: ${selectedHost.hostName} (${selectedHost.hostEmail}) using ${config.strategy} strategy`
  )

  // Create booking with selected host's event type
  const booking = await calcomClient.createBooking({
    ...bookingParams,
    eventTypeId: selectedHost.eventTypeId,
    metadata: {
      ...bookingParams.metadata,
      round_robin_host: selectedHost.hostEmail,
      round_robin_strategy: config.strategy,
    },
  })

  // Store booking record with host info
  await supabase.from('bookings').insert({
    booking_id: booking.uid,
    host_email: selectedHost.hostEmail,
    host_name: selectedHost.hostName,
    start_time: booking.startTime,
    attendee_name: bookingParams.name,
    attendee_email: bookingParams.email,
    round_robin_config_id: configId,
    created_at: new Date().toISOString(),
  })

  return {
    booking,
    selectedHost,
  }
}

/**
 * Get round-robin statistics
 * Shows booking distribution across hosts
 */
export async function getRoundRobinStats(
  configId: string,
  startDate?: string,
  endDate?: string
): Promise<{
  hosts: Array<{
    hostEmail: string
    hostName: string
    bookingCount: number
  }>
  totalBookings: number
}> {
  let query = supabase
    .from('bookings')
    .select('host_email, host_name')
    .eq('round_robin_config_id', configId)

  if (startDate) {
    query = query.gte('start_time', startDate)
  }

  if (endDate) {
    query = query.lte('start_time', endDate)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching round-robin stats:', error)
    throw new Error('Failed to get round-robin stats')
  }

  // Count bookings per host
  const hostCounts = new Map<string, { hostName: string; count: number }>()

  data?.forEach((booking: any) => {
    const existing = hostCounts.get(booking.host_email)
    if (existing) {
      existing.count++
    } else {
      hostCounts.set(booking.host_email, {
        hostName: booking.host_name,
        count: 1,
      })
    }
  })

  const hosts = Array.from(hostCounts.entries()).map(([email, { hostName, count }]) => ({
    hostEmail: email,
    hostName,
    bookingCount: count,
  }))

  return {
    hosts,
    totalBookings: data?.length || 0,
  }
}
