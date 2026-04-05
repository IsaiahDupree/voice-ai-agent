import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { niche, campaignId, reason } = body

    if (!niche) {
      return NextResponse.json(
        { error: 'niche is required' },
        { status: 400 }
      )
    }

    const today = new Date()
    const dayOfWeek = today.getDay()
    const todayDate = today.toISOString().split('T')[0]

    // Check if there's already an override for today
    const { data: existingOverride } = await supabaseAdmin
      .from('localreach_niche_overrides')
      .select('*')
      .eq('override_date', todayDate)
      .single()

    if (existingOverride) {
      // Update existing override
      const { data, error } = await supabaseAdmin
        .from('localreach_niche_overrides')
        .update({
          niche,
          campaign_id: campaignId || null,
          reason: reason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('override_date', todayDate)
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        success: true,
        action: 'updated',
        override: data,
        message: `Today's niche overridden to "${niche}"`,
      })
    } else {
      // Create new override
      const { data, error } = await supabaseAdmin
        .from('localreach_niche_overrides')
        .insert({
          override_date: todayDate,
          day_of_week: dayOfWeek,
          niche,
          campaign_id: campaignId || null,
          reason: reason || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      return NextResponse.json({
        success: true,
        action: 'created',
        override: data,
        message: `Today's niche overridden to "${niche}"`,
      })
    }
  } catch (error: any) {
    console.error('[Today Override API] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to override today\'s niche' },
      { status: 500 }
    )
  }
}
