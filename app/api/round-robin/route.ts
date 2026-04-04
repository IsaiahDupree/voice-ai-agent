// F0292: Round-robin booking API endpoint

import { NextRequest, NextResponse } from 'next/server'
import {
  createRoundRobinBooking,
  getRoundRobinStats,
  type RoundRobinConfig,
} from '@/lib/round-robin-booking'
import { apiResponse } from '@/lib/api-response'

/**
 * POST /api/round-robin
 * Create a round-robin booking with automatic host selection
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const config: RoundRobinConfig = {
      hosts: body.hosts,
      strategy: body.strategy || 'sequential',
    }

    const bookingParams = {
      start: body.start,
      name: body.name,
      email: body.email,
      phone: body.phone,
      notes: body.notes,
      timeZone: body.timeZone,
      metadata: body.metadata,
      contactId: body.contactId,
      callId: body.callId,
    }

    const configId = body.configId || 'default'

    // Validation
    if (!config.hosts || config.hosts.length === 0) {
      return apiResponse.error('At least one host is required', 400)
    }

    if (!['sequential', 'weighted', 'least-busy'].includes(config.strategy)) {
      return apiResponse.error(
        'Invalid strategy. Must be: sequential, weighted, or least-busy',
        400
      )
    }

    if (!bookingParams.start || !bookingParams.name || !bookingParams.email) {
      return apiResponse.error('Missing required fields: start, name, email', 400)
    }

    const result = await createRoundRobinBooking(config, bookingParams, configId)

    return apiResponse.success({
      booking: result.booking,
      selectedHost: {
        name: result.selectedHost.hostName,
        email: result.selectedHost.hostEmail,
      },
      strategy: config.strategy,
    })
  } catch (error: any) {
    console.error('Error creating round-robin booking:', error)
    return apiResponse.error(error.message || 'Failed to create booking', 500)
  }
}

/**
 * GET /api/round-robin/stats
 * Get round-robin booking statistics
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const configId = searchParams.get('configId') || 'default'
    const startDate = searchParams.get('startDate') || undefined
    const endDate = searchParams.get('endDate') || undefined

    const stats = await getRoundRobinStats(configId, startDate, endDate)

    return apiResponse.success(stats)
  } catch (error: any) {
    console.error('Error getting round-robin stats:', error)
    return apiResponse.error(error.message || 'Failed to get stats', 500)
  }
}
