// F1003: GET /api/numbers/available - Lists available numbers to purchase

import { NextRequest, NextResponse } from 'next/server'

/**
 * F1003: GET /api/numbers/available
 * Lists available phone numbers that can be purchased
 * Query params:
 *   - areaCode: Filter by area code (optional)
 *   - limit: Max results (default: 10, max: 100)
 *   - offset: Pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const areaCode = searchParams.get('areaCode')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // In production, this would query Vapi API or a number provisioning service
    // For now, return mock available numbers with area code support
    const mockNumbers = generateAvailableNumbers(areaCode, limit, offset)

    return NextResponse.json({
      success: true,
      available: mockNumbers,
      total: 1000, // Mock total available
      limit,
      offset,
      areaCode: areaCode || null,
    })
  } catch (error: any) {
    console.error('Error fetching available numbers:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch available numbers' },
      { status: 500 }
    )
  }
}

function generateAvailableNumbers(areaCode: string | null, limit: number, offset: number) {
  const numbers = []
  const baseAreaCode = areaCode || '415' // Default to SF area code

  for (let i = offset; i < offset + limit; i++) {
    const exchange = 200 + (i % 800)
    const subscriber = 1000 + i
    numbers.push({
      id: `number_${i}`,
      phone: `+1${baseAreaCode}${exchange.toString().padStart(3, '0')}${subscriber
        .toString()
        .slice(-4)}`,
      areaCode: baseAreaCode,
      country: 'US',
      type: 'local',
      capabilities: ['voice', 'sms'],
      monthlyPrice: 2.0,
      setupFee: 0,
      available: true,
    })
  }

  return numbers
}
