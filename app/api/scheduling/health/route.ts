/**
 * Feature 201: GET /api/scheduling/health
 * Test current scheduling provider connectivity and authentication
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSchedulingProvider } from '@/lib/scheduling'

export async function GET(request: NextRequest) {
  try {
    const provider = getSchedulingProvider()
    const currentProvider = process.env.SCHEDULING_PROVIDER || 'calcom'

    const startTime = Date.now()
    const healthResult = await provider.healthCheck()
    const responseTime = Date.now() - startTime

    return NextResponse.json({
      provider: {
        name: provider.name,
        configured: currentProvider,
        healthy: healthResult.healthy,
        responseTime: `${responseTime}ms`,
        error: healthResult.error || null,
      },
      timestamp: new Date().toISOString(),
      status: healthResult.healthy ? 'healthy' : 'unhealthy',
    })
  } catch (error: any) {
    console.error('Error in GET /api/scheduling/health:', error)
    return NextResponse.json(
      {
        provider: {
          name: process.env.SCHEDULING_PROVIDER || 'calcom',
          configured: process.env.SCHEDULING_PROVIDER || 'calcom',
          healthy: false,
          error: error.message,
        },
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
      },
      { status: 503 }
    )
  }
}
