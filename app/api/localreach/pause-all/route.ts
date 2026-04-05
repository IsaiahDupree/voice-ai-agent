import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    // Pause all active campaigns
    const { error } = await supabaseAdmin
      .from('localreach_campaigns')
      .update({ status: 'paused', paused_at: new Date().toISOString() })
      .eq('status', 'active')

    if (error) throw error

    return NextResponse.json({ success: true, message: 'All campaigns paused' })
  } catch (error: any) {
    console.error('[LocalReach Pause All API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to pause all campaigns' },
      { status: 500 }
    )
  }
}
