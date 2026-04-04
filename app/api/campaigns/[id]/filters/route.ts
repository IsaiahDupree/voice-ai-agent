// F0268: Campaign contact filter - Filter campaign contacts by field values before dial

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export interface CampaignFilters {
  tags_include?: string[] // Must have at least one of these tags
  tags_exclude?: string[] // Must NOT have any of these tags
  company_include?: string[] // Company must be in this list
  company_exclude?: string[] // Company must NOT be in this list
  dnc?: boolean // Include/exclude DNC contacts
  no_show_count_max?: number // Maximum no-show count
  custom_fields?: Record<string, any> // Match custom fields
  timezone?: string[] // Filter by timezone
}

// F0268: Set or update contact filters for a campaign
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const filters: CampaignFilters = body.filters

    if (!filters || typeof filters !== 'object') {
      return NextResponse.json(
        { error: 'filters object is required' },
        { status: 400 }
      )
    }

    // Verify campaign exists
    const { data: campaign, error: fetchError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    // Update campaign with filters
    const { data, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .update({
        contact_filters: filters,
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: 'Contact filters updated',
      filters: data.contact_filters,
    })
  } catch (error: any) {
    console.error('Error updating campaign filters:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update filters' },
      { status: 500 }
    )
  }
}

// F0268: Get campaign filters
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: campaign, error } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('contact_filters')
      .eq('id', params.id)
      .single()

    if (error || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      filters: campaign.contact_filters || {},
    })
  } catch (error: any) {
    console.error('Error fetching campaign filters:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch filters' },
      { status: 500 }
    )
  }
}
