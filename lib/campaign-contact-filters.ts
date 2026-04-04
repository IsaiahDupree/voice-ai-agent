// F0268: Campaign contact filter helpers

import { supabaseAdmin } from '@/lib/supabase'

export interface CampaignFilters {
  tags_include?: string[]
  tags_exclude?: string[]
  company_include?: string[]
  company_exclude?: string[]
  dnc?: boolean
  no_show_count_max?: number
  custom_fields?: Record<string, any>
  timezone?: string[]
}

/**
 * F0268: Fetch filtered contacts for a campaign
 * Returns only contacts that pass all filters
 */
export async function getFilteredCampaignContacts(
  campaignId: number,
  filters: CampaignFilters,
  limit?: number
): Promise<any[]> {
  // Fetch all pending campaign contacts
  let query = supabaseAdmin
    .from('voice_agent_campaign_contacts')
    .select(`
      *,
      contact:voice_agent_contacts(*)
    `)
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (limit) {
    query = query.limit(limit)
  }

  const { data: contacts, error } = await query

  if (error || !contacts) {
    console.error('Error fetching campaign contacts:', error)
    return []
  }

  // Apply filters
  const filteredContacts = contacts.filter(contact => {
    return matchesFilters(contact.contact, filters)
  })

  return filteredContacts
}

/**
 * F0268: Check if a contact matches campaign filters
 */
export function matchesFilters(contact: any, filters: CampaignFilters): boolean {
  // Filter by DNC flag
  if (filters.dnc === false && contact.dnc) {
    return false
  }

  // Filter by tags (include) - must have at least one required tag
  if (filters.tags_include && filters.tags_include.length > 0) {
    const contactTags = contact.tags || []
    const hasRequiredTag = filters.tags_include.some(tag => contactTags.includes(tag))
    if (!hasRequiredTag) {
      return false
    }
  }

  // Filter by tags (exclude) - must not have any excluded tag
  if (filters.tags_exclude && filters.tags_exclude.length > 0) {
    const contactTags = contact.tags || []
    const hasExcludedTag = filters.tags_exclude.some(tag => contactTags.includes(tag))
    if (hasExcludedTag) {
      return false
    }
  }

  // Filter by company (include)
  if (filters.company_include && filters.company_include.length > 0) {
    if (!filters.company_include.includes(contact.company)) {
      return false
    }
  }

  // Filter by company (exclude)
  if (filters.company_exclude && filters.company_exclude.length > 0) {
    if (filters.company_exclude.includes(contact.company)) {
      return false
    }
  }

  // Filter by no-show count
  if (filters.no_show_count_max !== undefined) {
    const noShowCount = contact.no_show_count || 0
    if (noShowCount > filters.no_show_count_max) {
      return false
    }
  }

  // Filter by timezone
  if (filters.timezone && filters.timezone.length > 0) {
    if (!filters.timezone.includes(contact.timezone)) {
      return false
    }
  }

  // Filter by custom fields
  if (filters.custom_fields) {
    const customFields = contact.custom_fields || {}
    for (const [key, value] of Object.entries(filters.custom_fields)) {
      if (Array.isArray(value)) {
        // Multiple allowed values
        if (!value.includes(customFields[key])) {
          return false
        }
      } else {
        // Exact match
        if (customFields[key] !== value) {
          return false
        }
      }
    }
  }

  return true
}
