// F0249: Campaign notes - Rich text notes field on campaign record
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { campaign_id, notes } = body

    if (!campaign_id) {
      return NextResponse.json(
        { error: 'Missing required field: campaign_id' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaign_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, campaign: data })
  } catch (error: any) {
    console.error('Update campaign notes error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update notes' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const campaignId = searchParams.get('campaign_id')

    if (!campaignId) {
      return NextResponse.json(
        { error: 'Missing required parameter: campaign_id' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('id, name, notes')
      .eq('id', campaignId)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notes: data.notes || '', campaign: data })
  } catch (error: any) {
    console.error('Get campaign notes error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get notes' },
      { status: 500 }
    )
  }
}
