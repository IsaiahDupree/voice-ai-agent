import { NextRequest, NextResponse } from 'next/server'
import { getLocalNumbersByRegion } from '@/lib/vapi'

// F0158: GET /api/vapi/phone-numbers/local - Get available local numbers by region
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const state = searchParams.get('state')
    const city = searchParams.get('city')
    const areaCode = searchParams.get('areaCode')
    const country = searchParams.get('country') || 'US'

    const availableNumbers = await getLocalNumbersByRegion({
      state: state || undefined,
      city: city || undefined,
      areaCode: areaCode || undefined,
      country,
    })

    return NextResponse.json({
      success: true,
      numbers: availableNumbers,
      count: availableNumbers.length,
    })
  } catch (error: any) {
    console.error('Error fetching local numbers:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch local numbers',
        code: error.code,
      },
      { status: error.statusCode || 500 }
    )
  }
}
