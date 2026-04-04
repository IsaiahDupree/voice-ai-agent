// F0538, F0552: Recent SMS failures API

import { NextRequest, NextResponse } from 'next/server'
import { getRecentSMSFailures } from '@/lib/sms-analytics'

/**
 * GET /api/sms/analytics/failures?limit=20
 * F0538, F0552: Returns recent SMS failures with error codes
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limitStr = searchParams.get('limit')
    const limit = limitStr ? parseInt(limitStr, 10) : 20

    const failures = await getRecentSMSFailures(limit)

    return NextResponse.json({ failures })
  } catch (error: any) {
    console.error('[SMS Failures API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}
