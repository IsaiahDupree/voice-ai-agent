import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

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

    if (campaign.status === 'active') {
      return NextResponse.json(
        { error: 'Campaign is already active' },
        { status: 409 }
      )
    }

    if (campaign.status === 'archived') {
      return NextResponse.json(
        { error: 'Cannot resume an archived campaign. Create a new campaign instead.' },
        { status: 409 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('localreach_campaigns')
      .update({
        status: 'active',
        paused_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      campaign: data,
      message: `Campaign "${campaign.name}" resumed`,
    })
  } catch (error: any) {
    console.error('[Campaign Resume API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to resume campaign' },
      { status: 500 }
    )
  }
}
