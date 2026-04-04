// F0268: Campaign contact filter preview - Preview which contacts will be included/excluded

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { CampaignFilters } from '../route'

/**
 * Apply campaign filters to contacts
 */
function applyFilters(contacts: any[], filters: CampaignFilters): { included: any[], excluded: any[] } {
  const included: any[] = []
  const excluded: any[] = []

  for (const contact of contacts) {
    let shouldInclude = true
    let exclusionReason = ''

    // Filter by DNC flag
    if (filters.dnc === false && contact.contact.dnc) {
      shouldInclude = false
      exclusionReason = 'DNC flag set'
    }

    // Filter by tags (include)
    if (filters.tags_include && filters.tags_include.length > 0) {
      const contactTags = contact.contact.tags || []
      const hasRequiredTag = filters.tags_include.some(tag => contactTags.includes(tag))
      if (!hasRequiredTag) {
        shouldInclude = false
        exclusionReason = `Missing required tags: ${filters.tags_include.join(', ')}`
      }
    }

    // Filter by tags (exclude)
    if (filters.tags_exclude && filters.tags_exclude.length > 0) {
      const contactTags = contact.contact.tags || []
      const hasExcludedTag = filters.tags_exclude.some(tag => contactTags.includes(tag))
      if (hasExcludedTag) {
        shouldInclude = false
        exclusionReason = `Has excluded tag: ${filters.tags_exclude.join(', ')}`
      }
    }

    // Filter by company (include)
    if (filters.company_include && filters.company_include.length > 0) {
      if (!filters.company_include.includes(contact.contact.company)) {
        shouldInclude = false
        exclusionReason = `Company not in include list`
      }
    }

    // Filter by company (exclude)
    if (filters.company_exclude && filters.company_exclude.length > 0) {
      if (filters.company_exclude.includes(contact.contact.company)) {
        shouldInclude = false
        exclusionReason = `Company in exclude list`
      }
    }

    // Filter by no-show count
    if (filters.no_show_count_max !== undefined) {
      const noShowCount = contact.contact.no_show_count || 0
      if (noShowCount > filters.no_show_count_max) {
        shouldInclude = false
        exclusionReason = `No-show count (${noShowCount}) exceeds max (${filters.no_show_count_max})`
      }
    }

    // Filter by timezone
    if (filters.timezone && filters.timezone.length > 0) {
      if (!filters.timezone.includes(contact.contact.timezone)) {
        shouldInclude = false
        exclusionReason = `Timezone not in filter list`
      }
    }

    // Filter by custom fields
    if (filters.custom_fields) {
      const customFields = contact.contact.custom_fields || {}
      for (const [key, value] of Object.entries(filters.custom_fields)) {
        if (Array.isArray(value)) {
          // Multiple allowed values
          if (!value.includes(customFields[key])) {
            shouldInclude = false
            exclusionReason = `Custom field ${key} not in allowed values`
            break
          }
        } else {
          // Exact match
          if (customFields[key] !== value) {
            shouldInclude = false
            exclusionReason = `Custom field ${key} does not match`
            break
          }
        }
      }
    }

    if (shouldInclude) {
      included.push(contact)
    } else {
      excluded.push({
        ...contact,
        exclusion_reason: exclusionReason,
      })
    }
  }

  return { included, excluded }
}

// F0268: Preview filtered contacts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Fetch campaign and filters
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from('voice_agent_campaigns')
      .select('contact_filters')
      .eq('id', params.id)
      .single()

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: 'Campaign not found' },
        { status: 404 }
      )
    }

    const filters: CampaignFilters = campaign.contact_filters || {}

    // Fetch all campaign contacts with contact details
    const { data: campaignContacts, error: contactsError } = await supabaseAdmin
      .from('voice_agent_campaign_contacts')
      .select(`
        *,
        contact:voice_agent_contacts(*)
      `)
      .eq('campaign_id', params.id)
      .eq('status', 'pending')

    if (contactsError) throw contactsError

    if (!campaignContacts || campaignContacts.length === 0) {
      return NextResponse.json({
        success: true,
        filters,
        total_contacts: 0,
        included_count: 0,
        excluded_count: 0,
        included: [],
        excluded: [],
      })
    }

    // Apply filters
    const { included, excluded } = applyFilters(campaignContacts, filters)

    return NextResponse.json({
      success: true,
      filters,
      total_contacts: campaignContacts.length,
      included_count: included.length,
      excluded_count: excluded.length,
      included: included.map(c => ({
        contact_id: c.contact.id,
        name: c.contact.name,
        phone: c.contact.phone,
        company: c.contact.company,
        tags: c.contact.tags,
        timezone: c.contact.timezone,
      })),
      excluded: excluded.map(c => ({
        contact_id: c.contact.id,
        name: c.contact.name,
        phone: c.contact.phone,
        company: c.contact.company,
        tags: c.contact.tags,
        timezone: c.contact.timezone,
        exclusion_reason: c.exclusion_reason,
      })),
    })
  } catch (error: any) {
    console.error('Error previewing filtered contacts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to preview filters' },
      { status: 500 }
    )
  }
}
