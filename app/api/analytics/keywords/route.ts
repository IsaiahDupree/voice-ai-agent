// F0868: Keyword frequency API endpoint

import { NextRequest } from 'next/server'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'
import { getKeywordFrequency } from '@/lib/transcript-analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date') || undefined
    const endDate = searchParams.get('end_date') || undefined
    const personaId = searchParams.get('persona_id') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')

    const keywords = await getKeywordFrequency(startDate, endDate, personaId, limit)

    return apiSuccess({
      keywords,
      count: keywords.length,
      filters: {
        start_date: startDate,
        end_date: endDate,
        persona_id: personaId,
        limit,
      },
    })
  } catch (error: any) {
    console.error('Keyword frequency error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get keyword frequency: ${error.message}`,
      500
    )
  }
}
