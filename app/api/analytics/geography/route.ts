// F0863: Geography map API endpoint

import { NextRequest } from 'next/server'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'
import { getGeographyAnalytics } from '@/lib/geography-analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date') || undefined
    const endDate = searchParams.get('end_date') || undefined
    const personaId = searchParams.get('persona_id') || undefined

    const geography = await getGeographyAnalytics(startDate, endDate, personaId)

    return apiSuccess({
      geography,
      filters: {
        start_date: startDate,
        end_date: endDate,
        persona_id: personaId,
      },
    })
  } catch (error: any) {
    console.error('Geography analytics error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get geography analytics: ${error.message}`,
      500
    )
  }
}
