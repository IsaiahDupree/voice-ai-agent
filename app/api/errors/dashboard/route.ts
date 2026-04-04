// F1317: Error dashboard - Admin view of recent errors with frequency
import { NextRequest, NextResponse } from 'next/server'
import { getErrorDashboardData, getSilencedErrors, silenceError, unsilenceError } from '@/lib/error-monitoring'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24', 10)

    const dashboardData = await getErrorDashboardData(hours)
    const silencedErrors = getSilencedErrors()

    return NextResponse.json({
      ...dashboardData,
      silenced_errors: silencedErrors,
    })
  } catch (error: any) {
    console.error('Error dashboard API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch error dashboard' },
      { status: 500 }
    )
  }
}

// F1488: Manage silenced errors
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, error_type } = body

    if (!action || !error_type) {
      return NextResponse.json({ error: 'action and error_type are required' }, { status: 400 })
    }

    if (action === 'silence') {
      silenceError(error_type)
    } else if (action === 'unsilence') {
      unsilenceError(error_type)
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "silence" or "unsilence"' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      action,
      error_type,
      silenced_errors: getSilencedErrors(),
    })
  } catch (error: any) {
    console.error('Error silence management error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to manage error silencing' },
      { status: 500 }
    )
  }
}
