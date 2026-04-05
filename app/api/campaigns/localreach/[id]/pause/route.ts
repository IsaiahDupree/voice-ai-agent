import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Verify campaign exists and is in a pausable state
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('localreach_campaigns')
      .select('id, status, name')
      .eq('id', id)
      .single()

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Campaign not found' },
          { status: 404 }
        )
      }
      throw fetchError
    }

    if (campaign.status === 'paused') {
      return NextResponse.json(
        { error: 'Campaign is already paused' },
        { status: 409 }
      )
    }

    if (campaign.status === 'archived') {
      return NextResponse.json(
        { error: 'Cannot pause an archived campaign' },
        { status: 409 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('localreach_campaigns')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      campaign: data,
      message: `Campaign "${campaign.name}" paused`,
    })
  } catch (error: any) {
    console.error('[Campaign Pause API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to pause campaign' },
      { status: 500 }
    )
  }
}
