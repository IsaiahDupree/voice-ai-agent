// F0256: Dialer warm-up API
// F0257: Predictive dial ratio API

import { NextRequest } from 'next/server'
import {
  initializeDialerWarmup,
  updateDialerWarmup,
  configurePredictiveDialing,
  calculateDialCount,
  getDialerState,
  resetDialerWarmup,
  type DialerWarmupConfig,
  type PredictiveDialConfig,
} from '@/lib/dialer-optimization'
import { apiResponse } from '@/lib/api-response'

/**
 * POST /api/dialer
 * Initialize or configure dialer settings
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    switch (action) {
      case 'init_warmup': {
        const config: DialerWarmupConfig = {
          campaign_id: body.campaign_id,
          initial_concurrency: body.initial_concurrency || 1,
          max_concurrency: body.max_concurrency,
          ramp_duration_minutes: body.ramp_duration_minutes || 30,
          step_size: body.step_size || 1,
          step_interval_minutes: body.step_interval_minutes || 5,
        }

        if (!config.campaign_id || !config.max_concurrency) {
          return apiResponse.error(
            'campaign_id and max_concurrency are required',
            400
          )
        }

        const state = await initializeDialerWarmup(config)
        return apiResponse.success({ state })
      }

      case 'configure_predictive': {
        const config: PredictiveDialConfig = {
          campaign_id: body.campaign_id,
          dial_ratio: body.dial_ratio,
          max_abandon_rate: body.max_abandon_rate || 3,
          auto_adjust: body.auto_adjust ?? true,
        }

        if (!config.campaign_id || !config.dial_ratio) {
          return apiResponse.error(
            'campaign_id and dial_ratio are required',
            400
          )
        }

        await configurePredictiveDialing(config)
        return apiResponse.success({
          message: 'Predictive dialing configured',
          config,
        })
      }

      case 'reset_warmup': {
        const { campaign_id } = body
        if (!campaign_id) {
          return apiResponse.error('campaign_id is required', 400)
        }

        await resetDialerWarmup(campaign_id)
        return apiResponse.success({ message: 'Dialer warm-up reset' })
      }

      default:
        return apiResponse.error(
          'Invalid action. Must be: init_warmup, configure_predictive, or reset_warmup',
          400
        )
    }
  } catch (error: any) {
    console.error('Dialer API error:', error)
    return apiResponse.error(error.message || 'Dialer operation failed', 500)
  }
}

/**
 * GET /api/dialer
 * Get dialer state or calculate dial count
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const campaignId = searchParams.get('campaign_id')
    const action = searchParams.get('action')

    if (!campaignId) {
      return apiResponse.error('campaign_id is required', 400)
    }

    switch (action) {
      case 'state': {
        const state = await getDialerState(campaignId)
        if (!state) {
          return apiResponse.error('Dialer state not found', 404)
        }
        return apiResponse.success({ state })
      }

      case 'update_warmup': {
        const state = await updateDialerWarmup(campaignId)
        return apiResponse.success({ state })
      }

      case 'calculate_dial_count': {
        const availableAgents = parseInt(
          searchParams.get('available_agents') || '0'
        )
        if (availableAgents < 1) {
          return apiResponse.error('available_agents must be at least 1', 400)
        }

        const dialCount = await calculateDialCount(campaignId, availableAgents)
        return apiResponse.success({
          available_agents: availableAgents,
          dial_count: dialCount,
        })
      }

      default:
        return apiResponse.error(
          'Invalid action. Must be: state, update_warmup, or calculate_dial_count',
          400
        )
    }
  } catch (error: any) {
    console.error('Dialer API error:', error)
    return apiResponse.error(error.message || 'Dialer operation failed', 500)
  }
}
