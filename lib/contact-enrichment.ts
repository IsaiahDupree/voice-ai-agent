// F0584: Contact enrichment via Clearbit API

import { supabaseAdmin } from '@/lib/supabase'

export interface EnrichmentData {
  company?: {
    name: string
    domain?: string
    industry?: string
    size?: string
    logo?: string
  }
  title?: string
  role?: string
  seniority?: string
  location?: string
  linkedin?: string
  twitter?: string
}

/**
 * F0584: Enrich contact with Clearbit data
 * Requires CLEARBIT_API_KEY environment variable
 */
export async function enrichContact(params: {
  email?: string
  phone?: string
  name?: string
}): Promise<EnrichmentData | null> {
  const clearbitApiKey = process.env.CLEARBIT_API_KEY

  if (!clearbitApiKey) {
    console.warn('[Enrichment] CLEARBIT_API_KEY not configured, skipping enrichment')
    return null
  }

  if (!params.email && !params.phone) {
    console.warn('[Enrichment] Email or phone required for enrichment')
    return null
  }

  try {
    // Clearbit Person API
    // https://clearbit.com/docs#enrichment-api
    const url = new URL('https://person.clearbit.com/v2/combined/find')

    if (params.email) {
      url.searchParams.set('email', params.email)
    } else if (params.phone) {
      // Clearbit doesn't support phone lookup directly
      // Would need to use a service like Twilio Lookup or FullContact instead
      console.warn('[Enrichment] Phone-only lookup not supported by Clearbit')
      return null
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${clearbitApiKey}`,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[Enrichment] No data found for ${params.email}`)
        return null
      }
      throw new Error(`Clearbit API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Extract relevant fields from Clearbit response
    const enrichmentData: EnrichmentData = {}

    if (data.person) {
      enrichmentData.title = data.person.employment?.title
      enrichmentData.role = data.person.employment?.role
      enrichmentData.seniority = data.person.employment?.seniority
      enrichmentData.location = data.person.location
      enrichmentData.linkedin = data.person.linkedin?.handle
      enrichmentData.twitter = data.person.twitter?.handle
    }

    if (data.company) {
      enrichmentData.company = {
        name: data.company.name,
        domain: data.company.domain,
        industry: data.company.category?.industry,
        size: data.company.metrics?.employees
          ? `${data.company.metrics.employees} employees`
          : undefined,
        logo: data.company.logo,
      }
    }

    return enrichmentData
  } catch (error) {
    console.error('[Enrichment] Error enriching contact:', error)
    return null
  }
}

/**
 * F0584: Enrich contact and save to database
 */
export async function enrichAndSaveContact(contactId: string): Promise<{
  success: boolean
  enrichmentData?: EnrichmentData
}> {
  try {
    // Get contact data
    const { data: contact, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('id', contactId)
      .single()

    if (fetchError || !contact) {
      console.error('[Enrichment] Contact not found:', contactId)
      return { success: false }
    }

    // Skip if already enriched recently (within 30 days)
    if (contact.enriched_at) {
      const enrichedDate = new Date(contact.enriched_at)
      const daysSinceEnrichment = (Date.now() - enrichedDate.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSinceEnrichment < 30) {
        console.log(`[Enrichment] Contact ${contactId} enriched recently, skipping`)
        return { success: true, enrichmentData: contact.enrichment_data }
      }
    }

    // Enrich contact
    const enrichmentData = await enrichContact({
      email: contact.email,
      phone: contact.phone,
      name: contact.name,
    })

    if (!enrichmentData) {
      // No enrichment data found, but mark as attempted
      await supabaseAdmin
        .from('contacts')
        .update({
          enrichment_attempted: true,
          enrichment_attempted_at: new Date().toISOString(),
        })
        .eq('id', contactId)

      return { success: true }
    }

    // Save enrichment data to contact
    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update({
        enrichment_data: enrichmentData,
        enriched_at: new Date().toISOString(),
        enrichment_attempted: true,
        enrichment_attempted_at: new Date().toISOString(),
        // Also update direct fields for easier querying
        company: enrichmentData.company?.name,
        title: enrichmentData.title,
      })
      .eq('id', contactId)

    if (updateError) {
      console.error('[Enrichment] Failed to save enrichment data:', updateError)
      return { success: false }
    }

    console.log(`[Enrichment] Successfully enriched contact ${contactId}`)
    return { success: true, enrichmentData }
  } catch (error) {
    console.error('[Enrichment] Error enriching and saving contact:', error)
    return { success: false }
  }
}

/**
 * F0584: Batch enrich multiple contacts
 * Useful for enriching a list of contacts from a campaign
 */
export async function batchEnrichContacts(contactIds: string[]): Promise<{
  success: number
  failed: number
  total: number
}> {
  let success = 0
  let failed = 0

  for (const contactId of contactIds) {
    const result = await enrichAndSaveContact(contactId)
    if (result.success) {
      success++
    } else {
      failed++
    }

    // Rate limit: wait 200ms between requests to avoid hitting Clearbit limits
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  return {
    success,
    failed,
    total: contactIds.length,
  }
}

/**
 * Alternative enrichment provider: FullContact
 * Can be used if Clearbit is not available
 */
export async function enrichContactWithFullContact(params: {
  email?: string
  phone?: string
}): Promise<EnrichmentData | null> {
  const fullContactApiKey = process.env.FULLCONTACT_API_KEY

  if (!fullContactApiKey) {
    return null
  }

  try {
    const response = await fetch('https://api.fullcontact.com/v3/person.enrich', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fullContactApiKey}`,
      },
      body: JSON.stringify({
        email: params.email,
        phone: params.phone,
      }),
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`FullContact API error: ${response.status}`)
    }

    const data = await response.json()

    // Map FullContact response to our enrichment format
    const enrichmentData: EnrichmentData = {}

    if (data.employment) {
      enrichmentData.title = data.employment.title
      enrichmentData.company = {
        name: data.employment.name,
        domain: data.employment.domain,
      }
    }

    if (data.location) {
      enrichmentData.location = `${data.location.city}, ${data.location.region}, ${data.location.country}`
    }

    if (data.socialProfiles) {
      const linkedin = data.socialProfiles.find((p: any) => p.type === 'linkedin')
      const twitter = data.socialProfiles.find((p: any) => p.type === 'twitter')

      if (linkedin) enrichmentData.linkedin = linkedin.url
      if (twitter) enrichmentData.twitter = twitter.username
    }

    return enrichmentData
  } catch (error) {
    console.error('[Enrichment] FullContact error:', error)
    return null
  }
}
