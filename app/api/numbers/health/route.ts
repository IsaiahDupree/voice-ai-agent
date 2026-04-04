// F0169: Number health check API
// Monitor inbound numbers for missed routes

import { NextRequest, NextResponse } from 'next/server'
import { checkNumberHealth, checkAllNumbersHealth, getUnhealthyNumbers } from '@/lib/number-health'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const phoneNumberId = searchParams.get('id')
    const showAll = searchParams.get('all') === 'true'
    const showUnhealthy = searchParams.get('unhealthy') === 'true'

    // Single number health check
    if (phoneNumberId) {
      const health = await checkNumberHealth(phoneNumberId)
      return NextResponse.json(health)
    }

    // Get unhealthy numbers only
    if (showUnhealthy) {
      const unhealthy = await getUnhealthyNumbers()
      return NextResponse.json({
        count: unhealthy.length,
        numbers: unhealthy,
      })
    }

    // Check all numbers
    if (showAll) {
      const allHealth = await checkAllNumbersHealth()
      const unhealthy = allHealth.filter((h) => h.status !== 'healthy')

      return NextResponse.json({
        total: allHealth.length,
        healthy: allHealth.filter((h) => h.status === 'healthy').length,
        warning: allHealth.filter((h) => h.status === 'warning').length,
        unhealthy: allHealth.filter((h) => h.status === 'unhealthy').length,
        numbers: allHealth,
        issues: unhealthy,
      })
    }

    return NextResponse.json({
      error: 'Provide ?id=<phone_number_id> or ?all=true or ?unhealthy=true',
    }, { status: 400 })
  } catch (error: any) {
    console.error('Number health check error:', error)
    return NextResponse.json(
      { error: error.message || 'Health check failed' },
      { status: 500 }
    )
  }
}
