// F0169: Number health check
// Monitor inbound numbers for missed routes and health issues

import { supabaseAdmin } from './supabase'
import { listPhoneNumbers, VapiPhoneNumber } from './vapi'

export interface NumberHealthStatus {
  phone_number_id: string
  phone_number: string
  status: 'healthy' | 'warning' | 'unhealthy'
  last_inbound_call_at: string | null
  total_calls_24h: number
  missed_routes: number
  error_rate: number
  checked_at: string
  issues: string[]
}

/**
 * F0169: Check health of a specific phone number
 * Returns health status with issues detected
 */
export async function checkNumberHealth(phoneNumberId: string): Promise<NumberHealthStatus> {
  try {
    // Get phone number info
    const numbers = await listPhoneNumbers()
    const phoneNumber = numbers.find((n: VapiPhoneNumber) => n.id === phoneNumberId)

    if (!phoneNumber) {
      throw new Error(`Phone number ${phoneNumberId} not found`)
    }

    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // Get recent calls to this number
    const { data: calls } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('*')
      .eq('to_number', phoneNumber.number)
      .gte('started_at', yesterday.toISOString())

    const totalCalls = calls?.length || 0
    const missedRoutes = calls?.filter((c) => c.status === 'failed' || c.end_reason === 'routing_error').length || 0
    const errorRate = totalCalls > 0 ? (missedRoutes / totalCalls) * 100 : 0

    // Get last inbound call
    const { data: lastCall } = await supabaseAdmin
      .from('voice_agent_calls')
      .select('started_at')
      .eq('to_number', phoneNumber.number)
      .eq('direction', 'inbound')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    const lastInboundCallAt = lastCall?.started_at || null

    // Determine health status and issues
    const issues: string[] = []
    let status: 'healthy' | 'warning' | 'unhealthy' = 'healthy'

    // Check 1: No calls received in 24 hours
    if (!lastInboundCallAt) {
      issues.push('No inbound calls received (ever)')
      status = 'unhealthy'
    } else {
      const lastCallTime = new Date(lastInboundCallAt)
      const hoursSinceLastCall = (now.getTime() - lastCallTime.getTime()) / (1000 * 60 * 60)

      if (hoursSinceLastCall > 24) {
        issues.push(`No inbound calls in ${Math.floor(hoursSinceLastCall)} hours`)
        status = 'warning'
      }
    }

    // Check 2: High error rate
    if (errorRate > 10) {
      issues.push(`High error rate: ${errorRate.toFixed(1)}%`)
      status = 'unhealthy'
    } else if (errorRate > 5) {
      issues.push(`Elevated error rate: ${errorRate.toFixed(1)}%`)
      if (status === 'healthy') status = 'warning'
    }

    // Check 3: Many missed routes
    if (missedRoutes > 5) {
      issues.push(`${missedRoutes} routing failures in 24h`)
      status = 'unhealthy'
    }

    // Save health check result
    await supabaseAdmin.from('voice_agent_number_health').upsert(
      {
        phone_number_id: phoneNumberId,
        phone_number: phoneNumber.number,
        status,
        last_inbound_call_at: lastInboundCallAt,
        total_calls_24h: totalCalls,
        missed_routes: missedRoutes,
        error_rate: errorRate,
        checked_at: now.toISOString(),
        issues,
      },
      { onConflict: 'phone_number_id' }
    )

    return {
      phone_number_id: phoneNumberId,
      phone_number: phoneNumber.number,
      status,
      last_inbound_call_at: lastInboundCallAt,
      total_calls_24h: totalCalls,
      missed_routes: missedRoutes,
      error_rate: errorRate,
      checked_at: now.toISOString(),
      issues,
    }
  } catch (error) {
    console.error('Error checking number health:', error)
    throw error
  }
}

/**
 * F0169: Check health of all phone numbers
 * Returns array of health statuses
 */
export async function checkAllNumbersHealth(): Promise<NumberHealthStatus[]> {
  try {
    const numbers = await listPhoneNumbers()
    const healthStatuses: NumberHealthStatus[] = []

    for (const number of numbers) {
      try {
        const status = await checkNumberHealth(number.id)
        healthStatuses.push(status)
      } catch (error) {
        console.error(`Failed to check health for ${number.id}:`, error)
      }
    }

    return healthStatuses
  } catch (error) {
    console.error('Error checking all numbers health:', error)
    throw error
  }
}

/**
 * F0169: Get unhealthy numbers that need attention
 */
export async function getUnhealthyNumbers(): Promise<NumberHealthStatus[]> {
  try {
    const { data } = await supabaseAdmin
      .from('voice_agent_number_health')
      .select('*')
      .in('status', ['warning', 'unhealthy'])
      .order('checked_at', { ascending: false })

    return (data as NumberHealthStatus[]) || []
  } catch (error) {
    console.error('Error getting unhealthy numbers:', error)
    return []
  }
}
