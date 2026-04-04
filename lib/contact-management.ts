// F0598, F0600, F0602, F0605, F0606, F0608, F0621, F0622, F0624: CRM contact management

import { supabaseAdmin } from './supabase'

/**
 * F0598: Segment contacts by deal stage
 */
export async function getContactsByStage(stage: string): Promise<any[]> {
  const { data } = await supabaseAdmin
    .from('voice_agent_contacts')
    .select('*')
    .eq('deal_stage', stage)
    .order('updated_at', { ascending: false })

  return data || []
}

/**
 * F0598: Get all deal stages with contact counts
 */
export async function getStageDistribution(): Promise<
  Record<
    string,
    {
      count: number
      contacts: any[]
    }
  >
> {
  const { data: contacts } = await supabaseAdmin
    .from('voice_agent_contacts')
    .select('id, deal_stage, name, phone, email')

  if (!contacts) return {}

  const distribution: Record<string, { count: number; contacts: any[] }> = {}

  contacts.forEach((contact) => {
    const stage = contact.deal_stage || 'no_stage'

    if (!distribution[stage]) {
      distribution[stage] = { count: 0, contacts: [] }
    }

    distribution[stage].count++
    distribution[stage].contacts.push(contact)
  })

  return distribution
}

/**
 * F0600: Contact health check - validate contact data quality
 */
export interface ContactHealthCheck {
  contactId: number
  phone: string
  issues: string[]
  score: number // 0-100, higher is better
}

export async function checkContactHealth(contactId: number): Promise<ContactHealthCheck> {
  const { data: contact } = await supabaseAdmin
    .from('voice_agent_contacts')
    .select('*')
    .eq('id', contactId)
    .single()

  if (!contact) {
    return {
      contactId,
      phone: '',
      issues: ['Contact not found'],
      score: 0,
    }
  }

  const issues: string[] = []

  // Check phone format
  if (!contact.phone) {
    issues.push('Missing phone number')
  } else if (!contact.phone.startsWith('+')) {
    issues.push('Phone number not in E.164 format')
  }

  // Check email validity
  if (contact.email && !isValidEmail(contact.email)) {
    issues.push('Invalid email format')
  }

  // Check if contact has name
  if (!contact.name && !contact.first_name && !contact.last_name) {
    issues.push('Missing name')
  }

  // Check if contact is opted out
  if (contact.do_not_call) {
    issues.push('On Do Not Call list')
  }

  if (contact.opt_out_sms) {
    issues.push('Opted out of SMS')
  }

  // Check if contact has been contacted recently
  if (contact.last_contact) {
    const daysSinceContact = Math.floor(
      (Date.now() - new Date(contact.last_contact).getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSinceContact > 90) {
      issues.push(`No contact in ${daysSinceContact} days`)
    }
  } else {
    issues.push('Never contacted')
  }

  // Calculate health score (0-100)
  const maxScore = 100
  const deductionPerIssue = 20
  const score = Math.max(0, maxScore - issues.length * deductionPerIssue)

  return {
    contactId,
    phone: contact.phone,
    issues,
    score,
  }
}

/**
 * F0602: Full-text search across contact fields
 */
export async function searchContacts(query: string, limit: number = 50): Promise<any[]> {
  // Search across name, email, phone, company, notes
  const searchTerm = `%${query}%`

  const { data } = await supabaseAdmin
    .from('voice_agent_contacts')
    .select('*')
    .or(
      `name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm},company.ilike.${searchTerm},notes.ilike.${searchTerm},first_name.ilike.${searchTerm},last_name.ilike.${searchTerm}`
    )
    .limit(limit)

  return data || []
}

/**
 * F0605: Email validation
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * F0606: Update contact's updated_at timestamp
 * This happens automatically via database trigger, but can be called manually
 */
export async function touchContact(contactId: number): Promise<void> {
  await supabaseAdmin
    .from('voice_agent_contacts')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', contactId)
}

/**
 * F0608: Add note from agent to contact
 */
export async function addContactNote(
  contactId: number,
  note: string,
  author?: string
): Promise<void> {
  try {
    const { data: contact } = await supabaseAdmin
      .from('voice_agent_contacts')
      .select('notes, metadata')
      .eq('id', contactId)
      .single()

    if (!contact) {
      throw new Error('Contact not found')
    }

    // Append note with timestamp and author
    const timestamp = new Date().toISOString()
    const noteEntry = `[${timestamp}]${author ? ` ${author}:` : ''} ${note}`

    const updatedNotes = contact.notes
      ? `${contact.notes}\n\n${noteEntry}`
      : noteEntry

    // Also store structured notes in metadata
    const metadata = (contact.metadata as any) || {}
    const notesArray = metadata.notes || []
    notesArray.push({
      text: note,
      author: author || 'system',
      createdAt: timestamp,
    })

    await supabaseAdmin
      .from('voice_agent_contacts')
      .update({
        notes: updatedNotes,
        metadata: {
          ...metadata,
          notes: notesArray,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId)

    console.log(`[Contact] Added note to contact ${contactId}`)
  } catch (error) {
    console.error('[Contact] Error adding note:', error)
    throw error
  }
}

/**
 * F0621: Get contacts with pagination
 */
export async function getContactsPaginated(options: {
  page?: number
  pageSize?: number
  orderBy?: string
  ascending?: boolean
}): Promise<{
  data: any[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}> {
  const page = options.page || 1
  const pageSize = options.pageSize || 50
  const orderBy = options.orderBy || 'created_at'
  const ascending = options.ascending ?? false

  // Get total count
  const { count } = await supabaseAdmin
    .from('voice_agent_contacts')
    .select('*', { count: 'exact', head: true })

  const totalCount = count || 0
  const totalPages = Math.ceil(totalCount / pageSize)

  // Get page data
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data } = await supabaseAdmin
    .from('voice_agent_contacts')
    .select('*')
    .order(orderBy, { ascending })
    .range(from, to)

  return {
    data: data || [],
    page,
    pageSize,
    totalCount,
    totalPages,
  }
}

/**
 * F0622: Filter contacts by date range
 */
export async function getContactsByDateRange(options: {
  startDate: string
  endDate: string
  dateField?: 'created_at' | 'updated_at' | 'last_contact'
}): Promise<any[]> {
  const dateField = options.dateField || 'created_at'

  const { data } = await supabaseAdmin
    .from('voice_agent_contacts')
    .select('*')
    .gte(dateField, options.startDate)
    .lte(dateField, options.endDate)
    .order(dateField, { ascending: false })

  return data || []
}

/**
 * F0624: CRM contact analytics
 */
export interface ContactAnalytics {
  totalContacts: number
  activeContacts: number // Contacted in last 30 days
  newContacts: number // Created in last 7 days
  byStage: Record<string, number>
  bySource: Record<string, number>
  optOutRate: number
  averageCallCount: number
  averageBookingCount: number
}

export async function getContactAnalytics(): Promise<ContactAnalytics> {
  const { data: contacts } = await supabaseAdmin.from('voice_agent_contacts').select('*')

  if (!contacts || contacts.length === 0) {
    return {
      totalContacts: 0,
      activeContacts: 0,
      newContacts: 0,
      byStage: {},
      bySource: {},
      optOutRate: 0,
      averageCallCount: 0,
      averageBookingCount: 0,
    }
  }

  const totalContacts = contacts.length

  // Active contacts (contacted in last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const activeContacts = contacts.filter(
    (c) => c.last_contact && new Date(c.last_contact) >= thirtyDaysAgo
  ).length

  // New contacts (created in last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const newContacts = contacts.filter(
    (c) => c.created_at && new Date(c.created_at) >= sevenDaysAgo
  ).length

  // By stage
  const byStage: Record<string, number> = {}
  contacts.forEach((c) => {
    const stage = c.deal_stage || 'no_stage'
    byStage[stage] = (byStage[stage] || 0) + 1
  })

  // By source
  const bySource: Record<string, number> = {}
  contacts.forEach((c) => {
    const source = c.source || 'unknown'
    bySource[source] = (bySource[source] || 0) + 1
  })

  // Opt-out rate
  const optedOut = contacts.filter((c) => c.do_not_call || c.opt_out_sms).length
  const optOutRate = (optedOut / totalContacts) * 100

  // Average call/booking counts
  const totalCalls = contacts.reduce((sum, c) => sum + (c.call_count || 0), 0)
  const totalBookings = contacts.reduce((sum, c) => sum + (c.booking_count || 0), 0)

  const averageCallCount = totalCalls / totalContacts
  const averageBookingCount = totalBookings / totalContacts

  return {
    totalContacts,
    activeContacts,
    newContacts,
    byStage,
    bySource,
    optOutRate: Math.round(optOutRate * 100) / 100,
    averageCallCount: Math.round(averageCallCount * 100) / 100,
    averageBookingCount: Math.round(averageBookingCount * 100) / 100,
  }
}
