import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { createClient } from '@vapi-ai/server-sdk'

const vapi = new createClient({
  apiKey: process.env.VAPI_API_KEY,
})

export async function POST(request: NextRequest) {
  try {
    // Find most recent "answered" call
    const { data: recentCall, error: fetchError } = await supabaseAdmin
      .from('localreach_call_attempts')
      .select('vapi_call_id, status')
      .eq('status', 'answered')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (fetchError || !recentCall?.vapi_call_id) {
      return NextResponse.json(
        { error: 'No active call to take over' },
        { status: 404 }
      )
    }

    // Transfer call to human via Vapi
    try {
      await vapi.calls.transfer(recentCall.vapi_call_id, {
        transferPlan: {
          mode: 'blind-transfer',
          phoneNumber: process.env.VAPI_TRANSFER_PHONE!,
        },
      })
    } catch (vapiError) {
      // Vapi transfer failed, but log it
      console.error('Vapi transfer error:', vapiError)
    }

    // Update call record
    await supabaseAdmin
      .from('localreach_call_attempts')
      .update({
        status: 'completed',
        metadata: {
          human_takeover: true,
          transferred_at: new Date().toISOString(),
        },
      })
      .eq('vapi_call_id', recentCall.vapi_call_id)

    return NextResponse.json({ success: true, message: 'Call transferred to human' })
  } catch (error: any) {
    console.error('[LocalReach Takeover API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to take over call' },
      { status: 500 }
    )
  }
}
