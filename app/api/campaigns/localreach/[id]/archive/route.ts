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

    if (campaign.status === 'archived') {
      return NextResponse.json(
        { error: 'Campaign is already archived' },
        { status: 409 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('localreach_campaigns')
      .update({
        status: 'archived',
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      campaign: data,
      message: `Campaign "${campaign.name}" archived`,
    })
  } catch (error: any) {
    console.error('[Campaign Archive API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to archive campaign' },
      { status: 500 }
    )
  }
}
