// F0232: Outbound script A/B test
// F0260: Campaign A/B persona test
// Campaign-level A/B testing endpoints

import { NextRequest } from 'next/server'
import {
  assignVariant,
  getABTestResults,
  pauseABTest,
  resumeABTest,
  endABTest,
  getWinningVariant,
} from '@/lib/ab-testing'
import { apiResponse } from '@/lib/api-response'

/**
 * GET /api/ab-tests/campaign/assign?testId=xxx&contactId=xxx
 * Assign contact to variant
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const testId = searchParams.get('testId')
    const contactId = searchParams.get('contactId')

    if (!testId || !contactId) {
      return apiResponse.error('testId and contactId are required', 400)
    }

    const variant = await assignVariant(testId, contactId)

    return apiResponse.success({
      variant,
      assignment: {
        test_id: testId,
        contact_id: contactId,
        variant_id: variant.id,
      },
    })
  } catch (error: any) {
    console.error('Error assigning variant:', error)
    return apiResponse.error(error.message || 'Failed to assign variant', 500)
  }
}

/**
 * POST /api/ab-tests/campaign/results
 * Get A/B test results
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { testId, action } = body

    if (!testId) {
      return apiResponse.error('testId is required', 400)
    }

    switch (action) {
      case 'get_results': {
        const results = await getABTestResults(testId)
        return apiResponse.success({ results })
      }

      case 'get_winner': {
        const results = await getABTestResults(testId)
        const winner = getWinningVariant(results)
        return apiResponse.success({ winner, results })
      }

      case 'pause': {
        await pauseABTest(testId)
        return apiResponse.success({ message: 'Test paused' })
      }

      case 'resume': {
        await resumeABTest(testId)
        return apiResponse.success({ message: 'Test resumed' })
      }

      case 'end': {
        const results = await endABTest(testId)
        const winner = getWinningVariant(results)
        return apiResponse.success({
          message: 'Test completed',
          results,
          winner,
        })
      }

      default:
        return apiResponse.error(
          'Invalid action. Must be: get_results, get_winner, pause, resume, or end',
          400
        )
    }
  } catch (error: any) {
    console.error('Error in A/B test action:', error)
    return apiResponse.error(error.message || 'Failed to perform action', 500)
  }
}
