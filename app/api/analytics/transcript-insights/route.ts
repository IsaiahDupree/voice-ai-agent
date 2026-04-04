// F0867: Transcript analytics API endpoint

import { NextRequest } from 'next/server'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'
import { getTranscriptInsights } from '@/lib/transcript-analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date') || undefined
    const endDate = searchParams.get('end_date') || undefined
    const personaId = searchParams.get('persona_id') || undefined

    const insights = await getTranscriptInsights(startDate, endDate, personaId)

    return apiSuccess({
      insights,
      filters: {
        start_date: startDate,
        end_date: endDate,
        persona_id: personaId,
      },
    })
  } catch (error: any) {
    console.error('Transcript insights error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get transcript insights: ${error.message}`,
      500
    )
  }
}
