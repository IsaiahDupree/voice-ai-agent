// F0145: Call abandonment analytics API
// Track and report on call abandonment rates

import { NextRequest, NextResponse } from 'next/server'
import { getAbandonmentRate } from '@/lib/call-analytics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const assistantId = searchParams.get('assistant_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!assistantId) {
      return NextResponse.json({
        error: 'assistant_id query parameter is required',
      }, { status: 400 })
    }

    const stats = await getAbandonmentRate(assistantId, startDate || undefined, endDate || undefined)

    return NextResponse.json({
      assistant_id: assistantId,
      start_date: startDate,
      end_date: endDate,
      ...stats,
    })
  } catch (error: any) {
    console.error('Abandonment analytics error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get abandonment statistics' },
      { status: 500 }
    )
  }
}
