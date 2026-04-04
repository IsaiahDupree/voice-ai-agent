// F0869: Objection frequency API endpoint

import { NextRequest } from 'next/server'
import { apiSuccess, apiError, ErrorCodes } from '@/lib/api-response'
import { getObjectionFrequency } from '@/lib/transcript-analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('start_date') || undefined
    const endDate = searchParams.get('end_date') || undefined
    const personaId = searchParams.get('persona_id') || undefined

    const objections = await getObjectionFrequency(startDate, endDate, personaId)

    return apiSuccess({
      objections,
      count: objections.length,
      filters: {
        start_date: startDate,
        end_date: endDate,
        persona_id: personaId,
      },
    })
  } catch (error: any) {
    console.error('Objection frequency error:', error)
    return apiError(
      ErrorCodes.INTERNAL_ERROR,
      `Failed to get objection frequency: ${error.message}`,
      500
    )
  }
}
