// F0251: List active calls available for monitoring

import { NextRequest, NextResponse } from 'next/server'
import { getMonitorableCalls } from '@/lib/call-monitoring'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    const calls = await getMonitorableCalls(
      campaignId ? parseInt(campaignId) : undefined
    )

    return NextResponse.json({
      success: true,
      count: calls.length,
      calls: calls.map(call => ({
        call_id: call.id,
        vapi_call_id: call.vapi_call_id,
        contact_name: call.contacts?.name,
        contact_phone: call.contacts?.phone,
        company: call.contacts?.company,
        campaign_name: call.campaigns?.name,
        duration_seconds: Math.floor(
          (Date.now() - new Date(call.started_at).getTime()) / 1000
        ),
        started_at: call.started_at,
      })),
    })
  } catch (error: any) {
    console.error('Error listing monitorable calls:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list calls' },
      { status: 500 }
    )
  }
}
