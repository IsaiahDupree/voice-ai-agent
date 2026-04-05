/**
 * Feature 200: GET /api/scheduling/providers
 * List available scheduling providers and show which one is currently active
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSchedulingProvider, validateSchedulingConfig } from '@/lib/scheduling'

export async function GET(request: NextRequest) {
  try {
    const currentProvider = process.env.SCHEDULING_PROVIDER || 'calcom'
    const validation = validateSchedulingConfig()

    // List of all supported providers with their requirements
    const providers = [
      {
        name: 'calcom',
        displayName: 'Cal.com',
        active: currentProvider === 'calcom',
        configured: !!(process.env.CALCOM_API_KEY),
        requiredEnvVars: ['CALCOM_API_KEY'],
        optionalEnvVars: ['CALCOM_API_URL', 'CALCOM_EVENT_TYPE_ID'],
        description: 'Cal.com scheduling platform',
        docsUrl: 'https://cal.com/docs/api-reference',
      },
      {
        name: 'easyappointments',
        displayName: 'Easy!Appointments',
        active: currentProvider === 'easyappointments',
        configured: !!(
          process.env.EASYAPPOINTMENTS_API_URL && process.env.EASYAPPOINTMENTS_API_KEY
        ),
        requiredEnvVars: ['EASYAPPOINTMENTS_API_URL', 'EASYAPPOINTMENTS_API_KEY'],
        optionalEnvVars: ['EASYAPPOINTMENTS_SERVICE_ID'],
        description: 'Self-hosted open-source appointment booking system',
        docsUrl: 'https://easyappointments.org/docs/rest-api.html',
      },
      {
        name: 'google-calendar',
        displayName: 'Google Calendar',
        active: currentProvider === 'google-calendar',
        configured: !!(
          process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GOOGLE_REFRESH_TOKEN
        ),
        requiredEnvVars: [
          'GOOGLE_CLIENT_ID',
          'GOOGLE_CLIENT_SECRET',
          'GOOGLE_REFRESH_TOKEN',
        ],
        optionalEnvVars: ['GOOGLE_CALENDAR_ID'],
        description: 'Google Calendar API integration',
        docsUrl: 'https://developers.google.com/calendar/api/v3/reference',
      },
    ]

    // Get active provider details
    const activeProvider = providers.find((p) => p.active)

    return NextResponse.json({
      currentProvider: {
        name: currentProvider,
        displayName: activeProvider?.displayName || currentProvider,
        configured: activeProvider?.configured || false,
        valid: validation.valid,
        errors: validation.errors,
      },
      availableProviders: providers,
      switchInstructions:
        'To switch providers, set SCHEDULING_PROVIDER environment variable to one of: calcom, easyappointments, google-calendar',
    })
  } catch (error: any) {
    console.error('Error in GET /api/scheduling/providers:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
